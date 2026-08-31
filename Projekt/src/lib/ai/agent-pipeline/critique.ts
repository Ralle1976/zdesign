// Z.Design — Agent Pipeline: critique phase
//
// Anti-slop lint → Critique Theater (≤3 rounds, ship_best) → vision critique
// (1 round on the rendered page). Returns the best-scoring HTML.

import { lintHtml, type LintFinding } from '@/lib/ai/lint/anti-slop';
import {
  runCritiqueTheater,
  type TheaterResult,
} from '@/lib/ai/skills/critic-theater';
import { refinePrompt } from '@/lib/ai/skills/refine';
import { callTextLLM } from '@/lib/ai/call-text-llm';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { renderHtmlToPng, critiqueRendered } from '@/lib/ai/skills/vision-critique';
import { enforceConceptTokens } from '@/lib/ai/skills/palette-enforcer';
import { countVisibleImages } from '@/lib/ai/ensure-design-images';
import type { CritiqueResult, PipelineContext } from './types';
import { finalizeHtml } from './generate';

const GEN_MAX_TOKENS = 16384;
const THEATER_THRESHOLD = 8.0;
const VISION_TARGET = 7.5;

/** Map deterministic lint P0 findings into refine-shaped strings. */
function lintToRefinements(findings: LintFinding[]): string[] {
  return findings.map((f) => `MUST FIX: ${f.message} — ${f.fix}`);
}

function acceptHtmlDoc(s: string): string {
  // Reuse the simple contract: valid full document, else empty.
  const trimmed = s.trim();
  const lower = trimmed.toLowerCase();
  if (!(lower.startsWith('<!doctype') || lower.startsWith('<html'))) return '';
  if (s.length <= 1500 || !lower.includes('</html>')) return '';
  return trimmed;
}

export async function critiqueDesign(ctx: PipelineContext, initialHtml: string): Promise<CritiqueResult> {
  const { send, pushTrace } = ctx;
  let html = initialHtml;

  // ── Anti-slop lint on v1 ──
  let pendingLintP0: LintFinding[] = lintHtml(html).filter((f) => f.severity === 'P0');
  if (pendingLintP0.length > 0) {
    send({
      step: 'lint',
      label: 'Anti-Slop-Check v1',
      detail: `${pendingLintP0.length} P0-Funde: ${pendingLintP0.map((f) => f.id).join(', ')}`,
    });
  }

  // ── Critique Theater: ≤3 rounds, ship_best ──
  const MAX_ROUNDS = Math.max(1, Math.min(3, ctx.maxTheaterRounds));
  let bestHtml = html;
  let bestComposite = -1;
  let bestTheater: TheaterResult | null = null;
  let bestRound = 0;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    let theater: TheaterResult;
    try {
      theater = await runCritiqueTheater(html, ctx.brief, callTextLLM, {
        threshold: THEATER_THRESHOLD,
      });
    } catch (e) {
      console.warn('[agent-pipeline] theater round', round, 'failed:', e instanceof Error ? e.message : e);
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
    const merged = [...theater.refinements, ...lintToRefinements(pendingLintP0)];
    if (merged.length === 0) break;

    const refStart = Date.now();
    let refinedOk = false;
    try {
      const refRaw = cleanHtml(
        await callTextLLM(refinePrompt(html, merged, ctx.brief), {
          maxTokens: GEN_MAX_TOKENS,
          temperature: 0.4,
          timeoutMs: 300_000,
        }),
      );
      const refined = acceptHtmlDoc(refRaw);
      if (refined) {
        html = enforceConceptTokens(refined, ctx.concept);
        refinedOk = true;
        send({
          step: `refine-${round}`,
          label: `Verfeinert Runde ${round}`,
          detail: `${merged.length} Maßnahmen in ${((Date.now() - refStart) / 1000) | 0}s`,
        });
        const newP0 = lintHtml(html).filter((f) => f.severity === 'P0');
        if (newP0.length > 0) {
          send({
            step: 'lint',
            label: `Anti-Slop-Check Runde ${round}`,
            detail: `${newP0.length} P0-Funde: ${newP0.map((f) => f.id).join(', ')}`,
          });
        }
        pendingLintP0 = newP0;
      } else {
        console.warn('[agent-pipeline] refine output invalid, keeping previous version');
      }
    } catch (e) {
      console.warn('[agent-pipeline] refine failed:', e instanceof Error ? e.message : e);
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

  // ── Vision critique (1 round) — sees the rendered page, not just HTML text ──
  if (!ctx.skipVision) {
    try {
      const png = await renderHtmlToPng(html, { fullPage: true });
      if (png) {
        const vision = await critiqueRendered(png, {}, ctx.message);
        if (vision && vision.overall < VISION_TARGET && vision.problems.length > 0) {
          send({
            step: 'vision-critique',
            label: 'Vision-Kritik',
            detail: `${vision.overall.toFixed(1)}/10 — ${vision.problems.slice(0, 2).join(' · ')}`,
            composite: Number(vision.overall.toFixed(2)),
          });
          const visionRefinements = [
            ...vision.problems.map((p) => `VISION: ${p}`),
            ...vision.fixes.map((f) => `FIX: ${f}`),
            'ALLE bestehenden <img src="https://..."> Tags und Fotos BEHALTEN — nicht entfernen.',
          ];
          const refRaw = cleanHtml(
            await callTextLLM(refinePrompt(html, visionRefinements, ctx.brief), {
              maxTokens: GEN_MAX_TOKENS,
              temperature: 0.35,
              timeoutMs: 300_000,
            }),
          );
          const visionHtml = acceptHtmlDoc(refRaw);
          if (visionHtml && countVisibleImages(visionHtml) >= countVisibleImages(html)) {
            html = enforceConceptTokens(finalizeHtml(visionHtml, ctx), ctx.concept);
            send({
              step: 'vision-refine',
              label: 'Nach Vision verfeinert',
              detail: `Score-Ziel ${VISION_TARGET}`,
            });
          }
        } else if (vision) {
          send({
            step: 'vision-critique',
            label: 'Vision-Kritik',
            detail: `${vision.overall.toFixed(1)}/10 — kein Refine nötig`,
            composite: Number(vision.overall.toFixed(2)),
          });
        }
      }
    } catch (visionErr) {
      console.warn('[agent-pipeline] vision-critique skipped:', visionErr instanceof Error ? visionErr.message : visionErr);
    }
  }

  pushTrace('critique-done', 'Kritik abgeschlossen', `Composite ${bestComposite >= 0 ? bestComposite.toFixed(1) : '—'}/10`);
  return { html, bestComposite, bestTheater, bestRound };
}
