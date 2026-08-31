/**
 * multi-pass-pipeline.ts — IA → Images-first → Per-view HTML → Shell assembly.
 *
 * Replaces the single 16k-token one-shot with modular passes so each view
 * gets distinct layout and pre-locked imagery.
 *
 * Split for single responsibility:
 *   multi-pass/types.ts  — shared types
 *   multi-pass/ia.ts     — IA generation (Pass 1)
 *   multi-pass/shell.ts  — shell runtime + document assembly (Pass 3)
 *   this file            — view prompts (Pass 2b), global CSS (Pass 2a), orchestration
 */

import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import type { Concept } from '@/lib/ai/skills/creative-director';
import { buildReferenceAnchor } from '@/lib/ai/reference-rag';
import { ensureImageSlots, generateImagesFirst, imageMapToPromptBlock } from '@/lib/ai/images-first';
import { applyFreshImages } from '@/lib/ai/fresh-images';
import { ULTRA_IMAGE_RULES, ULTRA_QUALITY_BAR } from '@/lib/ai/ultra-quality';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';
import { generateIA } from '@/lib/ai/multi-pass/ia';
import { assembleDocument } from '@/lib/ai/multi-pass/shell';
import type {
  DesignIA,
  LLMCall,
  MultiPassInput,
  MultiPassOutput,
  ViewIA,
} from '@/lib/ai/multi-pass/types';

// Re-export shared types (backward compat — images-first.ts imports them here).
export type {
  DesignIA,
  ImageSlot,
  LLMCall,
  MultiPassInput,
  MultiPassOutput,
  ProgressFn,
  ViewIA,
} from '@/lib/ai/multi-pass/types';

const VIEW_MAX_TOKENS = 8192;
const GLOBAL_CSS_MAX_TOKENS = 4096;

function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 2000 &&
    lower.includes('</html>')
  );
}

function paletteBlock(brief: ArtBrief, concept?: Concept): string {
  if (concept) {
    const cp = concept.palette;
    return [
      `:root {`,
      `  --bg: ${cp.bg}; --surface: ${cp.surface}; --primary: ${cp.primary};`,
      `  --accent: ${cp.accent}; --text: ${cp.text}; --text-muted: ${cp.textMuted};`,
      `  --border: ${cp.border}; --display-font: ${concept.fonts.display}; --body-font: ${concept.fonts.body};`,
      `}`,
    ].join('\n');
  }
  const p = brief.palette;
  return [
    brief.system.rootCss,
    `/* Palette: bg ${p.background} accent ${p.accent} */`,
  ].join('\n');
}

function buildViewPrompt(
  view: ViewIA,
  ia: DesignIA,
  input: MultiPassInput,
  imageBlock: string,
  globalCss: string,
): string {
  const b = input.brief;
  const isAppShell = (b.experienceMode ?? 'app-shell') === 'app-shell';
  const isFirstView = ia.views[0]?.id === view.id;
  const activeClass = isFirstView ? ' is-active' : '';
  const hidden = isFirstView ? '' : ' hidden';

  return [
    ULTRA_QUALITY_BAR,
    ``,
    `Du bist Senior Frontend Engineer (Awwwards-Niveau). Generiere NUR EINE View-Section.`,
    ``,
    `PROJEKT: ${ia.title} — ${ia.tagline}`,
    `GLOBAL STYLE: ${ia.globalStyle}`,
    `VIEW: ${view.label} (${view.id}) — ${view.purpose}`,
    `LAYOUT (BINDEND, einzigartig): ${view.layoutHint}`,
    ``,
    `INHALT:`,
    ...view.sections.map(
      (s) => `- [${s.type}] ${s.headline}: ${s.body}`,
    ),
    ``,
    imageBlock,
    ...(isFirstView && input.interactiveBlock ? [input.interactiveBlock] : []),
    ULTRA_IMAGE_RULES,
    ``,
    `SHARED CSS (nutze diese Tokens, dupliziere :root NICHT):`,
    globalCss.slice(0, 3000),
    ``,
    `OUTPUT (exakt ein Element):`,
    `<section id="${view.id}" class="app-view${activeClass}" data-od-id="${view.id}"${hidden}>`,
    `  <style>/* view-scoped CSS */</style>`,
    `  <!-- vollständiger Inhalt mit mindestens 1 Bild aus imageSlots -->`,
    `</section>`,
    ``,
    isAppShell
      ? `KEINE anderen Views. KEIN <html>. NUR die eine <section> mit inline <style>.`
      : `Scroll-Section: <section id="${view.id}" data-od-id="${view.id}">…</section>`,
    `Mindestens 1 <img> mit vorgegebenen URLs. Mobile-first. Deutsch.`,
    `NUTZERAUFTRAG-Kontext: ${input.message.slice(0, 400)}`,
    `Antworte NUR mit dem <section>-Element.`,
  ].join('\n');
}

function extractSection(raw: string, viewId: string): string {
  const cleaned = cleanHtml(raw.trim());
  const match = cleaned.match(/<section[\s\S]*<\/section>/i);
  if (match) return match[0];
  if (cleaned.includes('<section')) {
    return cleaned + '</section>';
  }
  return `<section id="${viewId}" class="app-view" data-od-id="${viewId}">${cleaned}</section>`;
}

async function generateGlobalCss(
  ia: DesignIA,
  input: MultiPassInput,
  callLLM: LLMCall,
): Promise<string> {
  const b = input.brief;
  const prompt = [
    ULTRA_QUALITY_BAR,
    ``,
    `Erstelle SHARED CSS für eine ULTRA-PREMIUM Multi-View HTML-App (NUR CSS, kein HTML).`,
    `Titel: ${ia.title} · Mood: ${b.mood} · Domain: ${b.domain}`,
    `Global Style: ${ia.globalStyle}`,
    `Tokens (kopiere als :root Basis):`,
    paletteBlock(b, input.concept),
    ``,
    `Enthält: :root, body, .app-nav, .app-nav button, .app-view Basis, Typo-Skala (clamp),`,
    `Atmosphäre (Verlauf, Korn, Schatten), prefers-reduced-motion.`,
    `KEIN View-spezifisches Layout — nur globale Tokens + Nav + Utilities.`,
    `Antworte NUR mit CSS (kein <style> Tag).`,
  ].join('\n');

  try {
    const css = await callLLM(prompt, {
      maxTokens: GLOBAL_CSS_MAX_TOKENS,
      temperature: 0.45,
      timeoutMs: 120_000,
    });
    return css.replace(/```css?\s*/gi, '').replace(/```/g, '').trim();
  } catch {
    return paletteBlock(b, input.concept);
  }
}

/**
 * Run the full multi-pass pipeline. Returns null when skipped or on failure
 * (caller should fall back to single-pass generateHtmlPrompt).
 */
export async function runMultiPassPipeline(
  input: MultiPassInput,
  callLLM: LLMCall,
): Promise<MultiPassOutput | null> {
  if (input.existingHtml && input.existingHtml.length > 100) {
    return null;
  }

  const progress = input.onProgress ?? (() => {});

  const ref = buildReferenceAnchor(input.brief.domain);
  const refBlock = ref?.promptBlock ?? '';
  if (ref) {
    progress('reference-rag', 'Referenz-Stil geladen', ref.template.name);
  }

  progress('ia-start', 'IA-Struktur (Pass 1)', `${input.brief.domain}`);
  const ia = await generateIA(input, callLLM, refBlock);
  if (!ia) {
    progress('ia-failed', 'IA fehlgeschlagen', 'Fallback Single-Pass');
    return null;
  }
  progress(
    'ia-done',
    'IA-Struktur fertig',
    `${ia.views.length} Views · ${ia.title}`,
  );

  const iaWithSlots = ensureImageSlots(ia, input.brief, input.message);

  progress('images-first', 'Frische Bilder zuerst', 'Palette-Lock · kein Stock');
  const imgResult = await generateImagesFirst(iaWithSlots, input.brief, input.message);
  progress(
    'images-first-done',
    'Bilder frisch generiert',
    `${imgResult.generated} neu · ${imgResult.failed} fehlgeschlagen`,
  );
  const imageBlock = imageMapToPromptBlock(imgResult.map);

  progress('global-css', 'Shared CSS (Pass 2a)', 'Tokens + Nav');
  const globalCss = await generateGlobalCss(iaWithSlots, input, callLLM);

  const viewHtml: string[] = [];
  for (let i = 0; i < iaWithSlots.views.length; i++) {
    const view = iaWithSlots.views[i];
    progress('view-start', `View: ${view.label}`, `Pass 2b · ${i + 1}/${iaWithSlots.views.length}`);
    try {
      const raw = await callLLM(
        (input.lessonsBlock || '') +
          (input.memoryBlock || '') +
          (input.userMemoryBlock || '') +
          buildViewPrompt(view, iaWithSlots, input, imageBlock, globalCss),
        {
          maxTokens: VIEW_MAX_TOKENS,
          temperature: input.creativeMode ? 0.58 : 0.5,
          timeoutMs: 180_000,
        },
      );
      viewHtml.push(extractSection(raw, view.id));
    } catch (e) {
      console.warn(
        '[multi-pass] view failed',
        view.id,
        e instanceof Error ? e.message : e,
      );
      progress('view-failed', `View ${view.label} fehlgeschlagen`, 'Abbruch → Fallback');
      return null;
    }
  }

  progress('assemble', 'Shell zusammenbauen (Pass 3)', `${viewHtml.length} Sections`);
  let html = assembleDocument(iaWithSlots, viewHtml, globalCss, input);

  if (!isValidHtmlDoc(html)) {
    progress('assemble-failed', 'Assembly ungültig', 'Fallback Single-Pass');
    return null;
  }

  try {
    const fresh = await applyFreshImages(html, {
      domain: input.brief.domain,
      message: input.message,
      mood: input.brief.mood,
      palette: input.brief.palette,
      maxImages: 6,
    });
    if (fresh.generated > 0) {
      html = fresh.html;
      progress('images-refresh', 'Bilder aufgefrischt', `${fresh.generated} neu generiert`);
    }
  } catch {
    /* non-fatal */
  }

  progress(
    'multi-pass-done',
    'Multi-Pass fertig',
    `${(html.length / 1024).toFixed(1)} KB · Template ${ref?.template.id ?? '—'}`,
  );

  return {
    html,
    ia: iaWithSlots,
    templateId: ref?.template.id,
    imageCount: Object.keys(imgResult.map).length,
  };
}
