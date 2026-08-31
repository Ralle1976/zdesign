// Z.Design — Agent Pipeline: ship phase
//
// Final images, accessibility audit, learning (recipe/trace/history/lessons),
// persistence and the final `complete` SSE frame.

import { db } from '@/lib/db';
import { ensureDesignImages } from '@/lib/ai/ensure-design-images';
import { enforceConceptTokens } from '@/lib/ai/skills/palette-enforcer';
import { runAudits } from '@/lib/audit/runner';
import {
  loadApprovedRecipeForTopic,
  proposeRecipe,
  saveRecipeProposal,
  patchRecipe,
  LEARN_THRESHOLD,
} from '@/lib/ai/skills/skill-memory';
import { appendTrace } from '@/lib/ai/skills/trace-store';
import { recordDesign } from '@/lib/ai/memory/history';
import { saveResult, maybeReflect } from '@/lib/ai/memory/lessons';
import { lintHtml } from '@/lib/ai/lint/anti-slop';
import { callTextLLM } from '@/lib/ai/call-text-llm';
import type { CritiqueResult, PipelineContext } from './types';

export async function shipDesign(
  ctx: PipelineContext,
  critique: CritiqueResult,
): Promise<void> {
  const { send, pushTrace } = ctx;
  const { message, projectId, concept, brief } = ctx;
  const { html: bestHtml, bestComposite, bestTheater, bestRound } = critique;
  let html = bestHtml;
  const directionLabel = ctx.directionLabel;

  // ── Final images — inject curated photos, then optional AI upgrade ──
  if (!ctx.bodyExisting && !ctx.existing) {
    try {
      const imgFinal = await ensureDesignImages(html, {
        domain: brief.domain,
        message,
        mood: brief.mood,
        palette: brief.palette,
        tryGenerate: true,
        maxGenerate: 6,
        forceFresh: true,
      });
      html = enforceConceptTokens(imgFinal.html, concept);
      if (imgFinal.injected > 0 || imgFinal.generated > 0) {
        send({
          step: 'images-final',
          label: 'Bilder gesichert',
          detail: `${imgFinal.injected} eingefügt · ${imgFinal.generated} generiert`,
        });
      }
    } catch (imgErr) {
      console.warn('[agent-pipeline] ensureDesignImages failed:', imgErr instanceof Error ? imgErr.message : imgErr);
    }
  }

  // ── Audit loop (auto-fix contrast / a11y on best draft) ──
  try {
    const audit = runAudits(html);
    html = audit.html;
    send({
      step: 'audit',
      label: 'Accessibility-Audit',
      detail: `${audit.findings.length} Checks, ${audit.findings.filter((f) => f.autoFixed).length} auto-gefixt`,
    });
  } catch (e) {
    console.warn('[agent-pipeline] audit failed', e);
    send({
      step: 'audit',
      label: 'Accessibility-Audit übersprungen',
      detail: 'Fehler beim Audit',
    });
  }

  // ── LEARN (store / patch recipe) ──
  if (bestTheater && bestComposite >= LEARN_THRESHOLD) {
    try {
      const recipe = await proposeRecipe(
        brief.domain,
        html,
        directionLabel,
        bestTheater.summary,
        callTextLLM,
      );
      if (recipe) {
        const existingRecipe = await loadApprovedRecipeForTopic(brief.domain);
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
      console.warn('[agent-pipeline] learn failed', e);
    }
  }

  // ── TRACE store (non-fatal) ──
  if (bestTheater) {
    try {
      appendTrace({
        topic: brief.domain,
        brief: directionLabel,
        html,
        composite: bestComposite,
        perPanelist: bestTheater.perPanelist.map((p) => ({
          role: p.role,
          score: p.score,
          ...(p.summary ? { summary: p.summary } : {}),
          ...(p.refinements?.length ? { refinements: p.refinements } : {}),
        })),
      });
    } catch (e) {
      console.warn('[agent-pipeline] trace append failed', e);
    }
  }

  // ── Final lint surface ──
  const finalP0 = lintHtml(html).filter((f) => f.severity === 'P0').length;
  send({
    step: 'lint',
    label: 'Anti-Slop final',
    detail: `${finalP0} P0-Funde verbleibend`,
  });

  // ── Persist ──
  await db.project.update({
    where: { id: projectId },
    data: {
      designMode: 'HTML_ARTIFACT',
      designHTML: html,
      status: 'IN_PROGRESS',
    },
  });

  // ── DESIGN HISTORY (non-fatal) ──
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
    console.warn('[agent-pipeline] recordDesign failed:', e instanceof Error ? e.message : e);
  }

  // ── LESSONS (non-fatal) ──
  try {
    await saveResult({
      domain: brief.domain,
      outcome: bestComposite >= 7 ? 'useful' : 'dead_end',
      composite: bestComposite >= 0 ? bestComposite : 5,
      palette: concept?.palette?.accent ?? undefined,
      concept: concept?.name ?? undefined,
      detail:
        bestComposite >= 7
          ? concept?.layoutApproach ?? brief.archetype
          : bestTheater?.perPanelist?.find((p) => p.score < 7)?.summary ?? 'low quality',
    });
    maybeReflect();
  } catch {
    // non-fatal
  }

  // ── Scores projection (legacy spa-style kept for UI) ──
  const perPanelist = bestTheater?.perPanelist ?? [];
  const byRole = (r: string) => perPanelist.find((p) => p.role === r)?.score ?? null;
  const scores = bestTheater
    ? {
        composite: Number(bestTheater.composite.toFixed(2)),
        perPanelist: perPanelist.map((p) => ({ role: p.role, score: p.score })),
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
      metadata: JSON.stringify({
        agent: true,
        mode: 'HTML_ARTIFACT',
        trace: ctx.trace,
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
    trace: ctx.trace,
    scores,
    projectId,
    createdAt: assistantMessage.createdAt,
  });
}
