/**
 * image-harmony.ts — Cohesive image prompts + CSS grading tied to design palette.
 */

import type { DesignPalette } from './fusion/design-direction';

export interface ImageHarmonyContext {
  domain: string;
  mood?: string;
  palette?: Partial<DesignPalette>;
  /** Stable seed fragment for consistent generation across images. */
  styleSeed?: string;
}

/** Build a unified image prompt with palette-locked color grading. */
export function buildHarmonizedImagePrompt(
  subject: string,
  ctx: ImageHarmonyContext,
): string {
  const p = ctx.palette;
  const grade = p
    ? [
        `unified color grade matching brand palette`,
        `background tone ${p.background}`,
        `accent highlights ${p.accent}`,
        `primary shadows ${p.primary}`,
        `muted tones ${p.textMuted}`,
        `cohesive editorial series — same lighting and grade as sibling images`,
      ].join(', ')
    : `cohesive editorial color grade, harmonious warm-cool balance`;

  const mood = ctx.mood ? `, mood: ${ctx.mood}` : '';
  const seed = ctx.styleSeed ? `, style ref: ${ctx.styleSeed}` : '';

  return `${subject.trim()}. ${grade}${mood}${seed}. No clashing neon, no stock-photo generic look, no mixed color temperatures across the set.`;
}

/** Deterministic style seed from palette + domain (same brief → same grade). */
export function imageStyleSeed(domain: string, palette?: Partial<DesignPalette>): string {
  const key = `${domain}|${palette?.background ?? ''}|${palette?.accent ?? ''}|${palette?.primary ?? ''}`;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `series-${h.toString(36)}`;
}

const HARMONY_MARKER = '__zd_image_harmony__';

/**
 * Inject CSS that harmonizes all photos with the design palette
 * (subtle overlay + consistent saturation/contrast).
 */
export function applyImageHarmonyCss(
  html: string,
  palette?: Partial<DesignPalette>,
): string {
  if (html.includes(HARMONY_MARKER)) return html;
  const accent = palette?.accent ?? 'var(--accent, #c9a962)';
  const primary = palette?.primary ?? 'var(--primary, #1a1a1a)';

  const css = `
<style id="${HARMONY_MARKER}">
  figure, .img-wrap, [class*="visual"], [class*="hero"] { position: relative; overflow: hidden; }
  img { display: block; width: 100%; height: 100%; object-fit: cover; filter: saturate(0.88) contrast(1.04) brightness(0.97); }
  figure::after, .img-wrap::after, .od-hero-visual::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(180deg, color-mix(in oklch, ${primary} 8%, transparent) 0%, color-mix(in oklch, ${accent} 12%, transparent) 100%);
    mix-blend-mode: multiply;
    opacity: 0.35;
  }
  .app-view img, section img { border-radius: inherit; }
</style>`;

  if (/<\/head>/i.test(html)) return html.replace(/<\/head>/i, `${css}\n</head>`);
  if (/<style/i.test(html)) return html.replace(/(<style)/i, `${css}\n$1`);
  return css + html;
}