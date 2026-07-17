/**
 * Guarantees fresh, palette-harmonized images in every design output.
 */

import { applyFreshImages, generateHeroImage } from '@/lib/ai/fresh-images';
import { applyImageHarmonyCss } from '@/lib/ai/image-harmony';
import type { DesignPalette } from '@/lib/ai/fusion/design-direction';

const MIN_IMAGES = 3;

export function countVisibleImages(html: string): number {
  const imgs = [...html.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/gi)];
  const bg = [
    ...html.matchAll(/background(?:-image)?:\s*url\(["']?(https?:\/\/[^"')]+)/gi),
  ];
  return imgs.length + bg.length;
}

function injectHeroOnly(html: string, heroUrl: string, topic: string): string {
  const heroFigure = `
<figure class="od-hero-visual img-wrap" style="margin:0;width:100%;max-height:72vh;aspect-ratio:16/9;overflow:hidden">
  <img src="${heroUrl}" alt="${topic} — Hero" width="1200" height="675" style="width:100%;height:100%;object-fit:cover;display:block" loading="eager" decoding="async" />
</figure>`;

  if (/<section[^>]*(?:id|class)=["'][^"']*hero/i.test(html)) {
    return html.replace(
      /(<section[^>]*(?:id|class)=["'][^"']*hero[^"']*["'][^>]*>)/i,
      `$1\n${heroFigure}`,
    );
  }
  if (/<main[^>]*>/i.test(html)) {
    return html.replace(/(<main[^>]*>)/i, `$1\n${heroFigure}`);
  }
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/(<body[^>]*>)/i, `$1\n${heroFigure}`);
  }
  return html;
}

export async function ensureDesignImages(
  html: string,
  opts: {
    domain: string;
    message?: string;
    mood?: string;
    palette?: Partial<DesignPalette>;
    tryGenerate?: boolean;
    maxGenerate?: number;
    /** When true (default), replace ALL external images with freshly generated ones. */
    forceFresh?: boolean;
  },
): Promise<{ html: string; injected: number; generated: number }> {
  let result = html;
  const before = countVisibleImages(result);
  let injected = 0;
  let generated = 0;

  const freshOpts = {
    domain: opts.domain,
    message: opts.message || opts.domain,
    mood: opts.mood,
    palette: opts.palette,
    maxImages: opts.maxGenerate ?? 6,
  };

  if (before < 1 && opts.tryGenerate !== false) {
    const heroUrl = await generateHeroImage(freshOpts);
    if (heroUrl) {
      result = injectHeroOnly(result, heroUrl, freshOpts.message.slice(0, 48));
      injected = countVisibleImages(result) - before;
      generated += 1;
    }
  }

  const forceFresh = opts.forceFresh !== false;
  if (forceFresh && opts.tryGenerate !== false && countVisibleImages(result) > 0) {
    try {
      const rep = await applyFreshImages(result, freshOpts);
      result = rep.html;
      generated += rep.generated;
    } catch (e) {
      console.warn(
        '[ensure-design-images] fresh image pass failed:',
        e instanceof Error ? e.message : e,
      );
    }
  }

  if (countVisibleImages(result) < MIN_IMAGES && opts.tryGenerate !== false) {
    try {
      const rep = await applyFreshImages(result, { ...freshOpts, maxImages: MIN_IMAGES });
      result = rep.html;
      generated += rep.generated;
    } catch {
      /* non-fatal */
    }
  }

  result = applyImageHarmonyCss(result, opts.palette);

  return { html: result, injected, generated };
}