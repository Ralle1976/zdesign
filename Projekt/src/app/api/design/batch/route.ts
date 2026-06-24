// Z.Design — Batch design generation route (S3 Gallery + Batch).
//
// POST /api/design/batch { briefs, projectId? }
//   briefs: Array<{
//     name: string;
//     theme: string;
//     palette?: string;
//     fonts?: string;
//     layout?: string;
//     imagery?: string;
//     effects?: string;
//   }>
//
// For each brief this route:
//   1. creates (or reuses) a Project of type LANDING_PAGE,
//   2. builds a single art-directed HTML prompt from the brief fields,
//   3. calls the active LLM provider via callLLM (Provider abstraction),
//   4. persists the result as designMode=HTML_ARTIFACT + designHTML.
//
// Concurrency is capped at MAX_CONCURRENCY (5) parallel callLLM invocations so
// a large batch can't exhaust provider rate limits or memory. Returns
// { designs: [{ projectId, name, htmlKB, valid }] } plus an aggregate `errors`
// list for any brief that failed (a failure on one brief never aborts the rest).
//
// Validation: a generated doc is "valid" when it starts with <!doctype/<html,
// ends with </html> and is at least 1500 chars (same contract as the agent
// route). Truncated outputs are auto-closed before validation so a reliable
// ~23KB model output isn't discarded.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callLLM } from '@/lib/ai/provider';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { getDefaultDesignForType } from '@/lib/ai-prompts';

/** A single brief in the request body. */
interface DesignBrief {
  name: string;
  theme: string;
  palette?: string;
  fonts?: string;
  layout?: string;
  imagery?: string;
  effects?: string;
}

interface BatchBody {
  briefs: DesignBrief[];
  /** Optional shared project id. When set, every brief is saved as a new
   *  LANDING_PAGE project whose name is the brief name (the shared id is only
   *  used as a namespace hint / parent reference in logs). */
  projectId?: string;
}

export interface BatchDesignResult {
  projectId: string;
  name: string;
  htmlKB: number;
  valid: boolean;
}

/** Max parallel callLLM calls. Keeps us off provider rate limits. */
const MAX_CONCURRENCY = 5;

/** HTML validity contract — mirrors design/agent route. */
function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 1500 &&
    lower.includes('</html>')
  );
}

/** Auto-close a truncated doc (unclosed <style>/<script>/<body>/<html>). */
function autoCloseHtml(s: string): string {
  const trimmed = s.trim();
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('<!doctype') && !lower.startsWith('<html')) return s;
  if (/<\/html>\s*$/i.test(trimmed)) return trimmed;
  let out = trimmed;
  const openStyle = (out.match(/<style\b/gi) || []).length;
  const closeStyle = (out.match(/<\/style>/gi) || []).length;
  if (openStyle > closeStyle) out += '\n</style>';
  const openScript = (out.match(/<script\b/gi) || []).length;
  const closeScript = (out.match(/<\/script>/gi) || []).length;
  if (openScript > closeScript) out += '\n</script>';
  if (!/<\/body>\s*$/i.test(out)) out += '\n</body>';
  out += '\n</html>';
  return out;
}

/** Build a focused HTML-generation prompt from a brief. */
function buildBriefPrompt(brief: DesignBrief): string {
  const parts: string[] = [
    'Du bist ein Art Director und Frontend-Entwickler.',
    `Erzeuge eine COMPLETE, einzelständige HTML-Datei (mit <!doctype html>, <html>, <head>, <style> und <body>) für eine Landing Page.`,
    '',
    `Projektname: ${brief.name}`,
    `Thema / Briefing: ${brief.theme}`,
  ];
  if (brief.palette) parts.push(`Farbpalette: ${brief.palette}`);
  if (brief.fonts) parts.push(`Typografie: ${brief.fonts}`);
  if (brief.layout) parts.push(`Layout-Ansatz: ${brief.layout}`);
  if (brief.imagery) parts.push(`Bildsprache / Visuals: ${brief.imagery}`);
  if (brief.effects) parts.push(`Effekte / Materialität: ${brief.effects}`);

  parts.push(
    '',
    'Anforderungen:',
    '- Eine vollständige, produktionsreife HTML-Datei (kein Fragment, kein Markdown, keine Erklärungen).',
    '- Eigenes CSS inline in einem <style>-Block. Keine externen Abhängigkeiten außer Google Fonts via <link>.',
    '- Responsiv, semantisch, barrierearm (alt-Texte, Kontrast, focus-visible).',
    '- Hero, Features, Call-to-Action, Footer — alles art-directed und konkret zum Thema.',
    '- Antworte NUR mit der HTML-Datei, sonst nichts.',
  );
  return parts.join('\n');
}

/** Run an async mapper over `items` with at most `concurrency` in flight. */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BatchBody;
    const briefs = Array.isArray(body?.briefs) ? body.briefs : null;

    if (!briefs || briefs.length === 0) {
      return NextResponse.json(
        { error: 'briefs must be a non-empty array' },
        { status: 400 },
      );
    }
    if (briefs.length > 50) {
      return NextResponse.json(
        { error: 'Too many briefs (max 50 per batch)' },
        { status: 400 },
      );
    }
    // Reject briefs missing the required fields early — one bad brief shouldn't
    // start a provider call.
    for (const b of briefs) {
      if (!b || typeof b.name !== 'string' || !b.name.trim() || typeof b.theme !== 'string' || !b.theme.trim()) {
        return NextResponse.json(
          { error: 'Each brief requires non-empty { name, theme }' },
          { status: 400 },
        );
      }
    }

    const errors: Array<{ name: string; error: string }> = [];

    const designs: BatchDesignResult[] = await mapWithConcurrency(
      briefs,
      MAX_CONCURRENCY,
      async (brief) => {
        try {
          // 1) Create a LANDING_PAGE project for this brief.
          const project = await db.project.create({
            data: {
              name: brief.name,
              type: 'LANDING_PAGE',
              description: brief.theme,
              designJSON: JSON.stringify(getDefaultDesignForType('LANDING_PAGE')),
              status: 'IN_PROGRESS',
            },
          });

          // 2) Generate HTML via the Provider abstraction.
          const prompt = buildBriefPrompt(brief);
          const raw = cleanHtml(
            await callLLM(prompt, {
              maxTokens: 12000,
              temperature: 0.5,
              timeoutMs: 300_000,
            }),
          );
          const repaired = autoCloseHtml(raw);
          const valid = isValidHtmlDoc(repaired);
          const html = valid ? repaired : '';

          // 3) Persist. Even an invalid result is recorded (empty html) so the
          //    project exists and the gallery shows the failure — but `valid`
          //    lets the caller filter / retry.
          await db.project.update({
            where: { id: project.id },
            data: {
              designMode: 'HTML_ARTIFACT',
              designHTML: html,
              status: valid ? 'IN_PROGRESS' : 'DRAFT',
            },
          });

          return {
            projectId: project.id,
            name: brief.name,
            htmlKB: Math.round((html.length / 1024) * 10) / 10,
            valid,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Unknown batch error';
          console.error('[design/batch] brief failed:', brief.name, msg);
          errors.push({ name: brief.name, error: msg });
          return { projectId: '', name: brief.name, htmlKB: 0, valid: false };
        }
      },
    );

    return NextResponse.json({ designs, errors });
  } catch (error) {
    console.error('[design/batch] Error:', error);
    const msg = error instanceof Error ? error.message : 'Batch generation failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
