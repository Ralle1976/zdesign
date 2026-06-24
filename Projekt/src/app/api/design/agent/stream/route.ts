// Z.Design — Streaming Agentic Art-Directed Design route (SSE / N4).
//
// POST /api/design/agent/stream { message, projectId, concept? }
//
// Same agentic loop as /api/design/agent (art-direction → rationale → generate
// HTML → Critique Theater ≤3 rounds → ship_best → audit → learn → persist),
// but instead of blocking ~5min and returning JSON at the end, it streams
// progress to the client in real time via Server-Sent Events.
//
// Wire format: `Content-Type: text/event-stream`. Each step emits a frame:
//
//   data: {"step":"<name>","label":"<DE label>","detail?":"...","composite?":7.9}
//
// Steps emitted: art-direction, rationale, generate-start, generate-done, lint,
// theater-round-N, refine-N, audit, learn, complete, (error on failure).
//
// The final `complete` frame carries the same payload shape the synchronous
// route returns ({ id, message, html, mode, trace, scores, projectId }) so a
// client can swap the fetch target 1:1 and just consume events incrementally.
//
// The heavy lifting reuses the SAME functions as the sync route (callZai,
// runCritiqueTheater, buildArtBrief, runAudits, etc.) so behavior is identical.

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  buildArtBrief,
  briefLabel,
  generateHtmlPrompt,
} from '@/lib/ai/skills/art-direction';
import {
  runCritiqueTheater,
  type TheaterResult,
} from '@/lib/ai/skills/critic-theater';
import { refinePrompt } from '@/lib/ai/skills/refine';
import { callZai } from '@/lib/ai/zai-direct';
import type { Concept } from '@/lib/ai/skills/creative-director';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import {
  lintHtml,
  type LintFinding,
} from '@/lib/ai/lint/anti-slop';
import {
  loadApprovedRecipeForTopic,
  proposeRecipe,
  saveRecipeProposal,
  patchRecipe,
  LEARN_THRESHOLD,
} from '@/lib/ai/skills/skill-memory';
import { enforceConceptTokens } from '@/lib/ai/skills/palette-enforcer';
import { appendTrace } from '@/lib/ai/skills/trace-store';
import { runAudits } from '@/lib/audit/runner';
import { recordDesign } from '@/lib/ai/memory/history';

interface TraceStep {
  step: string;
  label: string;
  detail?: string;
}

/** Map deterministic lint P0 findings into refine-shaped strings. */
function lintToRefinements(findings: LintFinding[]): string[] {
  return findings.map((f) => `MUST FIX: ${f.message} — ${f.fix}`);
}

function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 1500 &&
    lower.includes('</html>')
  );
}

/** Auto-close a truncated model HTML output (see sync route for rationale). */
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

function acceptHtmlDoc(raw: string): string {
  const repaired = autoCloseHtml(raw);
  return isValidHtmlDoc(repaired) ? repaired : '';
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Build the SSE stream. We hand the consumer a ReadableStream and push frames
  // into its controller as the pipeline progresses. A dedicated async function
  // runs the pipeline and closes the stream when done (or on error).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          /* controller already closed — ignore */
        }
      };

      try {
        const body = await request.json();
        const {
          message,
          projectId,
          concept,
        } = body as { message: string; projectId: string; concept?: Concept };

        if (!message || !projectId) {
          send({ step: 'error', message: 'message and projectId are required' });
          controller.close();
          return;
        }
        const project = await db.project.findUnique({
          where: { id: projectId },
        });
        if (!project) {
          send({ step: 'error', message: 'Project not found' });
          controller.close();
          return;
        }

        const trace: TraceStep[] = [];
        const pushTrace = (
          step: string,
          label: string,
          detail?: string,
        ) => {
          trace.push({ step, label, detail });
          const frame: Record<string, unknown> = { step, label };
          if (detail !== undefined) frame.detail = detail;
          send(frame);
        };

        // 1) Art direction (deterministic).
        const brief = buildArtBrief(message);
        if (concept) brief.concept = concept;
        const directionLabel = briefLabel(brief);
        pushTrace('art-direction', 'Art Direction', directionLabel);
        if (concept) {
          pushTrace('concept', `Konzept: ${concept.name}`, concept.bigIdea);
        }

        // 1b) LEARN (load) — inject approved recipe as baseline.
        const learnedRecipe = await loadApprovedRecipeForTopic(brief.domain);
        if (learnedRecipe) {
          brief.learnedRecipe = learnedRecipe;
          pushTrace(
            'learn',
            'Bewährtes Rezept geladen',
            `Ø${learnedRecipe.sourceComposite} für ${brief.domain}`,
          );
        }

        // 1c) TWO-PASS rationale (only when a concept is present).
        let designRationale = '';
        if (concept) {
          const ratStart = Date.now();
          const rationalePrompt =
            `Du bist der Art Director für "${concept.name}".\n` +
            `Richtung: ${directionLabel}\n` +
            `Big Idea: ${concept.bigIdea}\n` +
            `Narrativ: ${concept.narrative}\n` +
            `Signature-Visual: ${concept.signatureVisual}\n` +
            `Layout-Ansatz: ${concept.layoutApproach}\n\n` +
            `Schreibe eine prägnante DESIGN-RATIONALE (~200 Wörter, deutsch), die begründet, ` +
            `WARUM diese Richtung funktioniert: welche Gesten, Hierarchie, Kontraste, Typografie ` +
            `und Materialität die Big Idea tragen und das WOW auslösen. Konkret und umsetzbar halten, ` +
            `kein Marketing-Blabla.`;
          try {
            designRationale = (
              await callZai(rationalePrompt, {
                maxTokens: 800,
                temperature: 0.7,
                thinking: true,
                timeoutMs: 180_000,
              })
            ).trim();
            pushTrace(
              'rationale',
              'Design-Rationale (Art Director)',
              `${designRationale.split(/\s+/).length} Wörter in ${(
                (Date.now() - ratStart) /
                1000
              ) | 0}s · thinking`,
            );
          } catch (e) {
            console.warn(
              '[design/agent/stream] rationale pass failed:',
              e instanceof Error ? e.message : e,
            );
            pushTrace(
              'rationale',
              'Design-Rationale übersprungen',
              'Pass 1 fehlgeschlagen — weiter mit Single-Pass',
            );
          }
        }

        // 2) Generate v1 HTML (with up to GEN_ATTEMPTS retries).
        const genStart = Date.now();
        const existing =
          project.designMode === 'HTML_ARTIFACT' && project.designHTML
            ? project.designHTML
            : undefined;
        const GEN_ATTEMPTS = 3;
        let html = '';
        const rationalePrefix = designRationale
          ? `DESIGN-RATIONALE (vom Art Director):\n${designRationale}\n\n`
          : '';

        send({
          step: 'generate-start',
          label: 'Entwurf wird generiert',
          detail: `${GEN_ATTEMPTS} Versuche · ${directionLabel}`,
        });

        for (let ga = 1; ga <= GEN_ATTEMPTS; ga++) {
          const raw = cleanHtml(
            await callZai(
              rationalePrefix + generateHtmlPrompt(brief, message, existing),
              {
                maxTokens: 12000,
                temperature: ga === 1 ? 0.5 : 0.3,
                timeoutMs: 300_000,
              },
            ),
          );
          const out = acceptHtmlDoc(raw);
          if (out) {
            html = enforceConceptTokens(out, concept);
            break;
          }
          console.warn(
            `[design/agent/stream] generate attempt ${ga}/${GEN_ATTEMPTS} invalid (len ${raw.length}), retrying`,
          );
          if (ga === GEN_ATTEMPTS) {
            throw new Error(
              'Die Generierung lieferte nach mehreren Versuchen kein vollständiges HTML-Dokument. Bitte erneut versuchen.',
            );
          }
        }
        send({
          step: 'generate-done',
          label: 'Entwurf v1 generiert',
          detail: `${(html.length / 1024).toFixed(1)} KB in ${(
            (Date.now() - genStart) /
            1000
          ) | 0}s`,
        });

        // 2b) Anti-slop lint on v1.
        let pendingLintP0: LintFinding[] = lintHtml(html).filter(
          (f) => f.severity === 'P0',
        );
        if (pendingLintP0.length > 0) {
          send({
            step: 'lint',
            label: 'Anti-Slop-Check v1',
            detail: `${pendingLintP0.length} P0-Funde: ${pendingLintP0
              .map((f) => f.id)
              .join(', ')}`,
          });
        }

        // 3) Critique Theater: ≤3 rounds, ship_best.
        const MAX_ROUNDS = 3;
        const THRESHOLD = 8.0;
        let bestHtml = html;
        let bestComposite = -1;
        let bestTheater: TheaterResult | null = null;
        let bestRound = 0;

        for (let round = 1; round <= MAX_ROUNDS; round++) {
          let theater: TheaterResult;
          try {
            theater = await runCritiqueTheater(html, brief, callZai, {
              threshold: THRESHOLD,
            });
          } catch (e) {
            console.warn(
              '[design/agent/stream] theater round',
              round,
              'failed:',
              e instanceof Error ? e.message : e,
            );
            send({
              step: `theater-round-${round}`,
              label: `Theater Runde ${round} übersprungen`,
              detail: 'keine auswertbare Bewertung',
            });
            break;
          }

          send({
            step: `theater-round-${round}`,
            label: `Theater Runde ${round}`,
            detail: theater.summary + (theater.satisfied ? ' ✓' : ''),
            composite: Number(theater.composite.toFixed(2)),
          });

          if (theater.composite > bestComposite) {
            bestComposite = theater.composite;
            bestHtml = html;
            bestTheater = theater;
            bestRound = round;
          }

          if (theater.satisfied) break;
          if (round === MAX_ROUNDS) break;

          // Merge panelist refinements with deterministic P0 fixes.
          const merged = [
            ...theater.refinements,
            ...lintToRefinements(pendingLintP0),
          ];
          if (merged.length === 0) break;

          const refStart = Date.now();
          let refinedOk = false;
          try {
            const refRaw = cleanHtml(
              await callZai(refinePrompt(html, merged, brief), {
                maxTokens: 12000,
                temperature: 0.4,
                timeoutMs: 300_000,
              }),
            );
            const refined = acceptHtmlDoc(refRaw);
            if (refined) {
              html = enforceConceptTokens(refined, concept);
              refinedOk = true;
              send({
                step: `refine-${round}`,
                label: `Verfeinert Runde ${round}`,
                detail: `${merged.length} Maßnahmen in ${(
                  (Date.now() - refStart) /
                  1000
                ) | 0}s`,
              });
              const newP0 = lintHtml(html).filter((f) => f.severity === 'P0');
              if (newP0.length > 0) {
                send({
                  step: 'lint',
                  label: `Anti-Slop-Check Runde ${round}`,
                  detail: `${newP0.length} P0-Funde: ${newP0
                    .map((f) => f.id)
                    .join(', ')}`,
                });
              }
              pendingLintP0 = newP0;
            } else {
              console.warn(
                '[design/agent/stream] refine output invalid, keeping previous version',
              );
            }
          } catch (e) {
            console.warn(
              '[design/agent/stream] refine failed:',
              e instanceof Error ? e.message : e,
            );
          }
          if (!refinedOk) {
            send({
              step: `refine-${round}`,
              label: `Verfeinern Runde ${round} verworfen`,
              detail: 'kein gültiges HTML — vorige Version behalten',
            });
            break;
          }
        }

        // ship_best.
        html = bestHtml;

        // 3a) AUDIT loop (auto-fix contrast / a11y on best draft).
        try {
          const audit = runAudits(html);
          html = audit.html;
          send({
            step: 'audit',
            label: 'Accessibility-Audit',
            detail: `${audit.findings.length} Checks, ${
              audit.findings.filter((f) => f.autoFixed).length
            } auto-gefixt`,
          });
        } catch (e) {
          console.warn('[design/agent/stream] audit failed', e);
          send({
            step: 'audit',
            label: 'Accessibility-Audit übersprungen',
            detail: 'Fehler beim Audit',
          });
        }

        // 3b) LEARN (store / patch recipe).
        if (bestTheater && bestComposite >= LEARN_THRESHOLD) {
          try {
            const recipe = await proposeRecipe(
              brief.domain,
              html,
              briefLabel(brief),
              bestTheater.summary,
              callZai,
            );
            if (recipe) {
              const existingRecipe =
                await loadApprovedRecipeForTopic(brief.domain);
              let saved: { id: string; approved: boolean };
              let patched: boolean;
              if (existingRecipe) {
                const p = await patchRecipe(brief.domain, recipe);
                saved = { id: p.id, approved: p.approved };
                patched = p.patched;
              } else {
                saved = await saveRecipeProposal(recipe);
                patched = false;
              }
              send({
                step: 'learn',
                label: patched
                  ? saved.approved
                    ? 'Rezept gepatched + auto-freigegeben'
                    : 'Rezept gepatched (gemerged)'
                  : saved.approved
                    ? 'Rezept gelernt + auto-freigegeben'
                    : 'Rezept vorgeschlagen (Pending)',
                detail: `Ø${bestComposite} → ${brief.domain}`,
              });
            }
          } catch (e) {
            console.warn('[design/agent/stream] learn failed', e);
          }
        }

        // 3c) TRACE store (non-fatal).
        if (bestTheater) {
          try {
            appendTrace({
              topic: brief.domain,
              brief: briefLabel(brief),
              html,
              composite: bestComposite,
              perPanelist: bestTheater.perPanelist.map((p) => ({
                role: p.role,
                score: p.score,
                ...(p.summary ? { summary: p.summary } : {}),
                ...(p.refinements?.length
                  ? { refinements: p.refinements }
                  : {}),
              })),
            });
          } catch (e) {
            console.warn('[design/agent/stream] trace append failed', e);
          }
        }

        // 4) Persist.
        const finalP0 = lintHtml(html).filter(
          (f) => f.severity === 'P0',
        ).length;
        send({
          step: 'lint',
          label: 'Anti-Slop final',
          detail: `${finalP0} P0-Funde verbleibend`,
        });

        await db.project.update({
          where: { id: projectId },
          data: {
            designMode: 'HTML_ARTIFACT',
            designHTML: html,
            status: 'IN_PROGRESS',
          },
        });

        // 4b) DESIGN HISTORY (non-fatal).
        try {
          await recordDesign({
            prompt: message,
            conceptName: concept?.name ?? null,
            domain: brief.domain,
            composite: bestComposite >= 0 ? bestComposite : null,
            palette: concept?.palette?.accent ?? null,
            projectId,
          });
        } catch (e) {
          console.warn(
            '[design/agent/stream] recordDesign failed:',
            e instanceof Error ? e.message : e,
          );
        }

        // Surface best-round scores (legacy spa-style projection kept for UI).
        const perPanelist = bestTheater?.perPanelist ?? [];
        const byRole = (r: string) =>
          perPanelist.find((p) => p.role === r)?.score ?? null;
        const scores = bestTheater
          ? {
              composite: Number(bestTheater.composite.toFixed(2)),
              perPanelist: perPanelist.map((p) => ({
                role: p.role,
                score: p.score,
              })),
              harmony: byRole('critic'),
              life: byRole('designer'),
              radiance: byRole('designer'),
              brand: byRole('brand'),
              a11y: byRole('a11y'),
              copy: byRole('copy'),
            }
          : null;
        const messageText = bestTheater
          ? `Art-directeter Entwurf via Theater · ${directionLabel} · Composite ${bestTheater.composite.toFixed(
              1,
            )}/10 (Runde ${bestRound})${bestTheater.satisfied ? ' ✓' : ''}.`
          : `Art-directeter Entwurf via Agent · ${directionLabel}.`;

        const assistantMessage = await db.chatMessage.create({
          data: {
            projectId,
            role: 'assistant',
            content: messageText,
            metadata: JSON.stringify({
              agent: true,
              mode: 'HTML_ARTIFACT',
              trace,
              scores,
            }),
          },
        });

        // Final complete frame — carries the same payload the sync route returns.
        send({
          step: 'complete',
          label: messageText,
          id: assistantMessage.id,
          message: messageText,
          html,
          mode: 'HTML_ARTIFACT',
          designMode: 'HTML_ARTIFACT',
          trace,
          scores,
          projectId,
          createdAt: assistantMessage.createdAt,
        });
      } catch (error) {
        console.error('[design/agent/stream] Error:', error);
        const msg =
          error instanceof Error ? error.message : 'Agent design failed';
        send({ step: 'error', message: msg });
      } finally {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disable proxy buffering so events flush immediately (Caddy/Nginx/CF).
      'X-Accel-Buffering': 'no',
    },
  });
}
