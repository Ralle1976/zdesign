// Z.Design — Agentic Art-Directed Design route.
//
// POST /api/design/agent { message, projectId, maxRefines? }
//
// Runs an AGENTIC loop (not single-shot): art-direction → generate HTML →
// Critique Theater (5 panelists, weighted composite, ≤3 rounds, ship_best).
// Produces a complete, art-directed HTML document rendered live in the canvas
// (HTML_ARTIFACT mode), the medium that lets Harmonie/Leben/Ausstrahlung
// actually be expressed. Returns the final HTML + the agent trace so the UI can
// show the iterative process.
//
// Calls the funded Z.ai ANTHROPIC endpoint DIRECTLY (no Fusion middleman) via
// callZai — same drop-in contract as the old callFusionText path — with
// HTML-focused "skill" prompts (see src/lib/ai/skills/).

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildArtBrief, briefLabel, generateHtmlPrompt } from '@/lib/ai/skills/art-direction';
import { runCritiqueTheater, type TheaterResult } from '@/lib/ai/skills/critic-theater';
import { refinePrompt } from '@/lib/ai/skills/refine';
import { callZai } from '@/lib/ai/zai-direct';
import type { Concept } from '@/lib/ai/skills/creative-director';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { lintHtml, type LintFinding } from '@/lib/ai/lint/anti-slop';
import { loadApprovedRecipeForTopic, proposeRecipe, saveRecipeProposal, patchRecipe, LEARN_THRESHOLD } from '@/lib/ai/skills/skill-memory';
import { enforceConceptTokens } from '@/lib/ai/skills/palette-enforcer';
import { appendTrace } from '@/lib/ai/skills/trace-store';
import { runAudits } from '@/lib/audit/runner';
import { recordDesign } from '@/lib/ai/memory/history';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';

/** Map deterministic lint P0 findings into the same shape as probabilistic
 *  critique refinements, so refine gets BOTH signals in one pass. */
function lintToRefinements(findings: LintFinding[]): string[] {
  return findings.map(f => `MUST FIX: ${f.message} — ${f.fix}`);
}

interface TraceStep {
  step: string;
  label: string;
  detail?: string;
}

/** A valid HTML artifact: starts with doctype/html and is substantial enough to
 *  be a real page. Guards against the model emitting prose / scratch notes / a
 *  fragment instead of the full document (which would overwrite a good version). */
function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 1500 &&
    lower.includes('</html>')
  );
}

/**
 * Repair a model HTML output that was TRUNCATED by the max_tokens ceiling — the
 * single most common failure on rich single-file pages (the doc ends mid-<style>
 * or mid-<body> without </body></html>). We close, in order, any still-open
 * <script>, <style>, </section> is left alone, then </body> + </html>. Only
 * acts on strings that already start like a real document; leaves clean docs and
 * non-documents untouched. Returns the (possibly repaired) string.
 *
 * This is what turns the model's reliable-but-truncated ~23KB output into a
 * shippable document instead of discarding it as "invalid".
 */
function autoCloseHtml(s: string): string {
  const trimmed = s.trim();
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith('<!doctype') && !lower.startsWith('<html')) return s;
  if (/<\/html>\s*$/i.test(trimmed)) return trimmed; // already complete
  let out = trimmed;
  // Close an unclosed <style ...> (most common truncation point on verbose CSS).
  const openStyle = (out.match(/<style\b/gi) || []).length;
  const closeStyle = (out.match(/<\/style>/gi) || []).length;
  if (openStyle > closeStyle) out += '\n</style>';
  // Close an unclosed <script ...>.
  const openScript = (out.match(/<script\b/gi) || []).length;
  const closeScript = (out.match(/<\/script>/gi) || []).length;
  if (openScript > closeScript) out += '\n</script>';
  // Close body + html if missing.
  if (!/<\/body>\s*$/i.test(out)) out += '\n</body>';
  out += '\n</html>';
  return out;
}

/**
 * Accept + normalize a generate/refine output: tolerate truncation by
 * auto-closing, then validate. Returns the document to use, or '' if the output
 * was not a real document at all (prose / scratch / fragment).
 */
function acceptHtmlDoc(raw: string): string {
  const repaired = autoCloseHtml(raw);
  return isValidHtmlDoc(repaired) ? repaired : '';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, projectId, concept } = body as { message: string; projectId: string; concept?: Concept };

    if (!message || !projectId) {
      return NextResponse.json({ error: 'message and projectId are required' }, { status: 400 });
    }
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const trace: TraceStep[] = [];

    // 1) Art direction (deterministic, no Fusion call).
    const brief = buildArtBrief(message);
    if (concept) brief.concept = concept;
    const directionLabel = briefLabel(brief);
    trace.push({ step: 'art-direction', label: `Art Direction`, detail: `${directionLabel}` });
    if (concept) {
      trace.push({ step: 'concept', label: `Konzept: ${concept.name}`, detail: concept.bigIdea });
    }

    // 1b) LEARNING loop (load): if a recipe was previously approved for this
    //     topic, inject it as the strong baseline so generate starts from it
    //     instead of from zero. generateHtmlPrompt renders it as
    //     "BEWÄHRTE BASIS" before the rest of the brief.
    const learnedRecipe = await loadApprovedRecipeForTopic(brief.domain);
    if (learnedRecipe) {
      brief.learnedRecipe = learnedRecipe;
      trace.push({
        step: 'learned-recipe',
        label: 'Bewährtes Rezept geladen',
        detail: `Ø${learnedRecipe.sourceComposite} für ${brief.domain}`,
      });
    }

    // 1b-bis) NEGATIVE MEMORY (avoid loop): recall past failures + learned
    //   anti-patterns for this domain and inject them as a "VERMEIDE" block so
    //   the model does NOT repeat them. Surfaces in the agent trace (UI-visible).
    const memory = await recallAntiPatterns({ domain: brief.domain, maxTokens: 800 });
    const memoryBlock =
      memory.items.length > 0
        ? `\n\nAUS DEM GEDÄCHTNIS — vergangene Fehler für „${brief.domain}", UNBEDINGT VERMEIDEN:\n${memory.items
            .map((i) => `- ${i.text}`)
            .join('\n')}\nKeines dieser Muster wiederholen.\n`
        : '';
    trace.push({
      step: 'negative-memory',
      label: memory.items.length
        ? `Gedächtnis: ${memory.items.length} zu vermeidende Muster`
        : 'Gedächtnis: keine vergangenen Fehler für diese Domain',
      detail: memory.items.length
        ? memory.items.map((i) => i.text.replace(/<[^>]+>/g, '')).slice(0, 5).join(' · ')
        : undefined,
    });

    // 1c) TWO-PASS (Q3): when a concept is present, FIRST run an Art-Director
    //     thinking pass that produces a concise design rationale, THEN prepend
    //     it to the production HTML prompt. The rationale primes the model with
    //     a clear, reasoned direction BEFORE it commits ~23KB of markup, which
    //     materially raises first-attempt quality (less generic, more on-brief).
    //     Without a concept we stay single-pass exactly as before.
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
        trace.push({
          step: 'rationale',
          label: 'Design-Rationale (Art Director)',
          detail: `${designRationale.split(/\s+/).length} Wörter in ${(((Date.now() - ratStart) / 1000) | 0)}s · thinking`,
        });
      } catch (e) {
        console.warn('[design/agent] rationale pass failed:', e instanceof Error ? e.message : e);
        trace.push({ step: 'rationale', label: 'Design-Rationale übersprungen', detail: 'Pass 1 fehlgeschlagen — weiter mit Single-Pass' });
      }
    }

    // 2) Generate v1 HTML from the brief. Retry: the model occasionally emits
    //    prose / scratch notes instead of a full document. When a rationale was
    //    produced in Pass 1, it is PREPENDED to the production prompt so the
    //    model reasons from the Art Director's direction first.
    const genStart = Date.now();
    const existing = project.designMode === 'HTML_ARTIFACT' && project.designHTML ? project.designHTML : undefined;
    const GEN_ATTEMPTS = 3;
    let html = '';
    const rationalePrefix = designRationale
      ? `DESIGN-RATIONALE (vom Art Director):\n${designRationale}\n\n`
      : '';
    for (let ga = 1; ga <= GEN_ATTEMPTS; ga++) {
      const raw = cleanHtml(
        await callZai(rationalePrefix + memoryBlock + generateHtmlPrompt(brief, message, existing), {
          maxTokens: 12000,
          temperature: ga === 1 ? 0.5 : 0.3,
          timeoutMs: 300_000,
        }),
      );
      const out = acceptHtmlDoc(raw);
      if (out) {
        html = enforceConceptTokens(out, concept);
        break;
      }
      console.warn(`[design/agent] generate attempt ${ga}/${GEN_ATTEMPTS} invalid (len ${raw.length}), retrying`);
      if (ga === GEN_ATTEMPTS) {
        throw new Error('Die Generierung lieferte nach mehreren Versuchen kein vollständiges HTML-Dokument. Bitte erneut versuchen.');
      }
    }
    trace.push({ step: 'generate', label: `Entwurf v1 generiert`, detail: `${(html.length / 1024).toFixed(1)} KB in ${(((Date.now() - genStart) / 1000) | 0)}s` });

    // 2b) Deterministic anti-slop floor: lint v1, collect P0 findings to merge
    //     into the first refine. This runs UNDER the probabilistic critique —
    //     catches the cardinal sins the model may gloss over.
    let pendingLintP0: LintFinding[] = lintHtml(html).filter(f => f.severity === 'P0');
    if (pendingLintP0.length > 0) {
      trace.push({
        step: 'lint',
        label: 'Anti-Slop-Check v1',
        detail: `${pendingLintP0.length} P0-Funde: ${pendingLintP0.map(f => f.id).join(', ')}`,
      });
    }

    // 3) Critique Theater: 5 panelists in parallel, weighted composite, ≤3 rounds.
    //    ship_best: keep the highest-composite version seen (theater may regress on
    //    a round; we never ship a worse draft than an earlier one).
    const MAX_ROUNDS = 3;
    const THRESHOLD = 8.0;
    let bestHtml = html;
    let bestComposite = -1;
    let bestTheater: TheaterResult | null = null;
    let bestRound = 0;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      let theater: TheaterResult;
      try {
        theater = await runCritiqueTheater(html, brief, callZai, { threshold: THRESHOLD });
      } catch (e) {
        console.warn('[design/agent] theater round', round, 'failed:', e instanceof Error ? e.message : e);
        trace.push({ step: 'theater', label: `Theater Runde ${round} übersprungen`, detail: 'keine auswertbare Bewertung' });
        break;
      }

      trace.push({
        step: 'theater',
        label: `Theater Runde ${round}`,
        detail: theater.summary + (theater.satisfied ? ' ✓' : ''),
      });

      // Track best (highest composite) across all rounds — ship_best uses this.
      if (theater.composite > bestComposite) {
        bestComposite = theater.composite;
        bestHtml = html;
        bestTheater = theater;
        bestRound = round;
      }

      if (theater.satisfied) break;
      if (round === MAX_ROUNDS) break;

      // MERGE panelist refinements with deterministic slop P0 fixes so refine
      // addresses BOTH in this pass.
      const merged = [...theater.refinements, ...lintToRefinements(pendingLintP0)];
      if (merged.length === 0) break;

      const refStart = Date.now();
      try {
        const refRaw = cleanHtml(
          await callZai(refinePrompt(html, merged, brief), { maxTokens: 12000, temperature: 0.4, timeoutMs: 300_000 }),
        );
        const refined = acceptHtmlDoc(refRaw);
        if (refined) {
          html = enforceConceptTokens(refined, concept);
          const refCount = merged.length;
          trace.push({
            step: 'refine',
            label: `Verfeinert Runde ${round}`,
            detail: `${refCount} Maßnahmen in ${(((Date.now() - refStart) / 1000) | 0)}s`,
          });

          // Re-lint the refined html; collect NEW P0 findings to feed into the
          // next theater round so the loop keeps addressing them.
          const newP0 = lintHtml(html).filter(f => f.severity === 'P0');
          if (newP0.length > 0) {
            trace.push({
              step: 'lint',
              label: `Anti-Slop-Check Runde ${round}`,
              detail: `${newP0.length} P0-Funde: ${newP0.map(f => f.id).join(', ')}`,
            });
          }
          pendingLintP0 = newP0;
        } else {
          // Model emitted prose/scratch or a fragment instead of a full doc — keep
          // the previous (valid) version instead of overwriting it with garbage.
          console.warn('[design/agent] refine output invalid (len ' + refRaw.length + '), keeping previous version');
          trace.push({ step: 'refine', label: `Verfeinern Runde ${round} verworfen`, detail: 'kein gültiges HTML — vorige Version behalten' });
          break;
        }
      } catch (e) {
        console.warn('[design/agent] refine failed:', e instanceof Error ? e.message : e);
        trace.push({ step: 'refine', label: `Verfeinern Runde ${round} fehlgeschlagen`, detail: 'vorversion behalten' });
        break;
      }
    }

    // ship_best: prefer the highest-composite draft over the last one. The
    // theater may regress on a late round; we never ship a worse version.
    html = bestHtml;

    // 3a) AUDIT LOOP (A1-A2-A7): after ship_best, run the deterministic
    //     accessibility audit on the best draft. Auto-fixes (contrast
    //     darkening, alt-text, focus-visible, viewport, lang, skip-link)
    //     are applied directly to the HTML that gets persisted + shipped.
    //     Non-fatal: a failure must never block the response. This runs
    //     AFTER the Theater and BEFORE persist, on bestHtml.
    try {
      const audit = runAudits(html);
      html = audit.html;
      trace.push({
        step: 'audit',
        label: 'Accessibility-Audit',
        detail:
          audit.findings.length +
          ' Checks, ' +
          audit.findings.filter((f) => f.autoFixed).length +
          ' auto-gefixt',
      });
    } catch (e) {
      console.warn('[design/agent] audit failed', e);
      trace.push({ step: 'audit', label: 'Accessibility-Audit übersprungen', detail: 'Fehler beim Audit' });
    }

    // 3b) LEARNING loop (store + patch): after the Theater converges, if the
    //     shipped draft scored well, extract a recipe and persist it. PATCH
    //     when an approved recipe already exists for this topic (merge soul
    //     gestures + keep the higher-composite palette/fonts, bump version);
    //     otherwise save a fresh proposal (auto-approve at AUTO_APPROVE, else
    //     pending). Non-fatal: a learn failure must never break the response.
    if (bestTheater && bestComposite >= LEARN_THRESHOLD) {
      try {
        const bestTheaterSummary = bestTheater.summary;
        const recipe = await proposeRecipe(brief.domain, html, briefLabel(brief), bestTheaterSummary, callZai);
        if (recipe) {
          const existing = await loadApprovedRecipeForTopic(brief.domain);
          let saved: { id: string; approved: boolean };
          let patched: boolean;
          if (existing) {
            const p = await patchRecipe(brief.domain, recipe);
            saved = { id: p.id, approved: p.approved };
            patched = p.patched;
          } else {
            saved = await saveRecipeProposal(recipe);
            patched = false;
          }
          trace.push({
            step: 'learned',
            label: patched
              ? (saved.approved ? 'Rezept gepatched + auto-freigegeben' : 'Rezept gepatched (gemerged)')
              : (saved.approved ? 'Rezept gelernt + auto-freigegeben' : 'Rezept vorgeschlagen (Pending)'),
            detail: `Ø${bestComposite} → ${brief.domain}`,
          });
        }
      } catch (e) {
        console.warn('[design/agent] learn failed', e);
      }
    }

    // 3c) TRACE store (for the offline GEPA evolver): append the shipped HTML
    //     (truncated) + composite + per-panelist scores AND the panelists'
    //     critiques (summary + refinements), so the optimizer can read WHY
    //     recent designs under-performed on aesthetics. Append-only, non-fatal.
    if (bestTheater) {
      try {
        appendTrace({
          topic: brief.domain,
          brief: briefLabel(brief),
          html,
          composite: bestComposite,
          // PanelistResult {role,score,refinements,summary} matches TracePanelist.
          perPanelist: bestTheater.perPanelist.map(p => ({
            role: p.role,
            score: p.score,
            ...(p.summary ? { summary: p.summary } : {}),
            ...(p.refinements?.length ? { refinements: p.refinements } : {}),
          })),
        });
      } catch (e) {
        console.warn('[design/agent] trace append failed', e);
      }
    }

    // 4) Persist as HTML_ARTIFACT. (html is already bestHtml from ship_best.)
    const finalP0 = lintHtml(html).filter(f => f.severity === 'P0').length;
    trace.push({ step: 'lint-final', label: 'Anti-Slop final', detail: `${finalP0} P0-Funde verbleibend` });

    await db.project.update({
      where: { id: projectId },
      data: { designMode: 'HTML_ARTIFACT', designHTML: html, status: 'IN_PROGRESS' },
    });

    // 4b) DESIGN HISTORY (M2): record this completed run so it can be searched
    //     / recalled later by domain or prompt. Non-fatal: a memory write
    //     failure must never break the response. composite only set when a
    //     theater actually scored it (bestComposite starts at -1).
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
      console.warn('[design/agent] recordDesign failed:', e instanceof Error ? e.message : e);
    }

    // Surface the BEST round's per-panelist scores + composite. Map to the
    // legacy {harmony,life,radiance} shape so the existing UI keeps rendering
    // the spa-style score line (designer→life/radiance, critic→harmony).
    const perPanelist = bestTheater?.perPanelist ?? [];
    const byRole = (r: string) => perPanelist.find(p => p.role === r)?.score ?? null;
    const scores = bestTheater
      ? {
          composite: Number(bestTheater.composite.toFixed(2)),
          perPanelist: perPanelist.map(p => ({ role: p.role, score: p.score })),
          // Legacy spa-style projection (kept for UI continuity):
          harmony: byRole('critic'),
          life: byRole('designer'),
          radiance: byRole('designer'),
          brand: byRole('brand'),
          a11y: byRole('a11y'),
          copy: byRole('copy'),
        }
      : null;
    const messageText = bestTheater
      ? `Art-directeter Entwurf via Theater · ${directionLabel} · Composite ${bestTheater.composite.toFixed(1)}/10 (Runde ${bestRound})${bestTheater.satisfied ? ' ✓' : ''}.`
      : `Art-directeter Entwurf via Agent · ${directionLabel}.`;

    const assistantMessage = await db.chatMessage.create({
      data: {
        projectId,
        role: 'assistant',
        content: messageText,
        metadata: JSON.stringify({ agent: true, mode: 'HTML_ARTIFACT', trace, scores }),
      },
    });

    return NextResponse.json({
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
    console.error('[design/agent] Error:', error);
    const msg = error instanceof Error ? error.message : 'Agent design failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
