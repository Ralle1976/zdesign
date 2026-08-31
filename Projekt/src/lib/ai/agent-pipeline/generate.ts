// Z.Design — Agent Pipeline: generate phase
//
// HTML generation: multi-pass (IA → images-first → per-view HTML → shell)
// with single-pass fallback, then deterministic post-processing
// (fonts, agency craft, experience runtime, product runtime).

import { runMultiPassPipeline } from '@/lib/ai/multi-pass-pipeline';
import { generateHtmlPrompt } from '@/lib/ai/skills/art-direction';
import { ensureGoogleFonts } from '@/lib/ai/ensure-google-fonts';
import { ensureExperienceRuntime } from '@/lib/ai/experience-stack';
import { ensureAppShell } from '@/lib/ai/app-shell';
import { injectAgencyCraft } from '@/lib/ai/skills/agency-craft';
import { injectProductRuntime } from '@/lib/ai/interactive-product';
import { enforceConceptTokens } from '@/lib/ai/skills/palette-enforcer';
import { callTextLLM } from '@/lib/ai/call-text-llm';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import type { GenerateResult, PipelineContext } from './types';

const GEN_MAX_TOKENS = 16384;
const GEN_ATTEMPTS = 3;

/** Auto-close a truncated model HTML output. */
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

function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 1500 &&
    lower.includes('</html>')
  );
}

function acceptHtmlDoc(raw: string): string {
  const repaired = autoCloseHtml(raw);
  return isValidHtmlDoc(repaired) ? repaired : '';
}

/** Deterministic post-processing shared by every generation path. */
function finalizeHtml(html: string, ctx: PipelineContext): string {
  let out = ensureGoogleFonts(html, ctx.brief.fonts.display, ctx.brief.fonts.body);
  out = injectAgencyCraft(out);
  out =
    ctx.brief.experienceMode === 'app-shell'
      ? ensureAppShell(out, 'app-shell')
      : ensureExperienceRuntime(out);
  if (ctx.interactive) out = injectProductRuntime(out);
  return out;
}

export async function generateDesign(ctx: PipelineContext): Promise<GenerateResult> {
  const genStart = Date.now();
  const { send } = ctx;

  send({
    step: 'generate-start',
    label: 'Entwurf wird generiert',
    detail: `Multi-Pass · ${ctx.directionLabel}`,
  });

  let html = '';
  let multiPassViews: number | undefined;
  let multiPassImages: number | undefined;
  let templateId: string | undefined;

  // ── Multi-pass (skipped for refinement-like requests) ──
  if (!ctx.isRefinementLike) {
    const multiPass = await runMultiPassPipeline(
      {
        brief: ctx.brief,
        message: ctx.message,
        concept: ctx.concept,
        existingHtml: ctx.existing,
        creativeMode: ctx.creativeMode,
        rationalePrefix: ctx.rationalePrefix,
        memoryBlock: ctx.memoryBlock,
        userMemoryBlock: ctx.userMemoryBlock,
        lessonsBlock: ctx.lessonsBlock,
        interactiveBlock: ctx.interactiveBlock,
        onProgress: (step, label, detail) => ctx.pushTrace(step, label, detail),
      },
      callTextLLM,
    );

    if (multiPass?.html) {
      html = enforceConceptTokens(multiPass.html, ctx.concept);
      multiPassViews = multiPass.ia.views.length;
      multiPassImages = multiPass.imageCount;
      templateId = multiPass.templateId;
      ctx.pushTrace(
        'generate',
        'Multi-Pass Pipeline',
        `${multiPass.ia.views.length} Views · ${multiPass.imageCount} Bilder${multiPass.templateId ? ` · Ref ${multiPass.templateId}` : ''}`,
      );
    }
  }

  // ── Single-pass fallback ──
  if (!html) {
    ctx.pushTrace('generate-fallback', 'Single-Pass Fallback', `${GEN_ATTEMPTS} Versuche`);
    for (let ga = 1; ga <= GEN_ATTEMPTS; ga++) {
      const raw = cleanHtml(
        await callTextLLM(
          ctx.rationalePrefix +
            ctx.lessonsBlock +
            ctx.userMemoryBlock +
            ctx.memoryBlock +
            ctx.agencyBlock +
            ctx.imageBlock +
            ctx.interactiveBlock +
            generateHtmlPrompt(ctx.brief, ctx.message, ctx.existing),
          {
            maxTokens: GEN_MAX_TOKENS,
            temperature: ga === 1 ? (ctx.creativeMode ? 0.62 : 0.55) : ctx.creativeMode ? 0.42 : 0.35,
            timeoutMs: 300_000,
          },
        ),
      );
      const out = acceptHtmlDoc(raw);
      if (out) {
        html = enforceConceptTokens(out, ctx.concept);
        break;
      }
      console.warn(`[agent-pipeline] generate attempt ${ga}/${GEN_ATTEMPTS} invalid (len ${raw.length}), retrying`);
      if (ga === GEN_ATTEMPTS) {
        throw new Error('Die Generierung lieferte nach mehreren Versuchen kein vollständiges HTML-Dokument. Bitte erneut versuchen.');
      }
    }
  }

  html = finalizeHtml(html, ctx);

  send({
    step: 'generate-done',
    label: 'Entwurf v1 generiert',
    detail: `${(html.length / 1024).toFixed(1)} KB in ${((Date.now() - genStart) / 1000) | 0}s`,
  });

  return { html, multiPassViews, multiPassImages, templateId, genMs: Date.now() - genStart };
}

export { finalizeHtml };
