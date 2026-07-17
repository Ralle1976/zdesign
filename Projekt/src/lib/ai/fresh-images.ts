/**
 * fresh-images.ts — Replace ALL page images with newly generated, palette-locked photos.
 * Every design run gets unique imagery — no recycled Unsplash/stock URLs.
 */

import { replaceAllImagesWithFresh } from '@/lib/ai/html-image-generator';
import { generateImageWithProvider } from '@/lib/ai/image-providers';
import { getActiveImageProvider } from '@/lib/ai/call-text-llm';
import {
  buildHarmonizedImagePrompt,
  imageStyleSeed,
} from '@/lib/ai/image-harmony';
import {
  generateImagesMinimax,
  isMinimaxImageConfigured,
  buildImagePrompts,
  buildThaiFoodPrompts,
} from '@/lib/ai/image-minimax';
import type { DesignPalette } from '@/lib/ai/fusion/design-direction';

export interface FreshImageOpts {
  domain: string;
  message: string;
  mood?: string;
  palette?: Partial<DesignPalette>;
  maxImages?: number;
}

/** Generate a single hero when the page has zero images. */
export async function generateHeroImage(opts: FreshImageOpts): Promise<string | null> {
  const hay = `${opts.message} ${opts.domain}`.toLowerCase();
  const isThai = /thai|pad thai|imbiss|curry|siam/.test(hay);
  const prompts = isThai
    ? buildThaiFoodPrompts(opts.message, '')
    : buildImagePrompts(opts.message, '');
  const subject = prompts[0] || opts.message.slice(0, 120);
  const styleSeed = `${imageStyleSeed(opts.domain, opts.palette)}-${Date.now()}`;

  const prompt = buildHarmonizedImagePrompt(subject, {
    domain: opts.domain,
    mood: opts.mood,
    palette: opts.palette,
    styleSeed,
  });

  if (isMinimaxImageConfigured()) {
    try {
      const imgs = await generateImagesMinimax([prompt], { aspectRatio: '16:9' }, 1);
      if (imgs[0]?.url) return imgs[0].url;
    } catch {
      /* fall through */
    }
  }

  try {
    const provider = await getActiveImageProvider();
    const img = await generateImageWithProvider(prompt, {
      provider: provider.id,
      model: provider.model,
      size: '1024x768',
    });
    return img?.url ?? null;
  } catch {
    return null;
  }
}

/**
 * Full fresh-image pass: replace every http(s) img + upgrade backgrounds where possible.
 */
export async function applyFreshImages(
  html: string,
  opts: FreshImageOpts,
): Promise<{ html: string; generated: number; failed: number }> {
  const max = opts.maxImages ?? 6;
  const result = await replaceAllImagesWithFresh(html, opts.domain, max, {
    mood: opts.mood,
    palette: opts.palette,
    message: opts.message,
    uniqueRun: true,
  });
  // Map 'replaced' to 'generated' to satisfy the function signature.
  return { html: result.html, generated: result.replaced ?? 0, failed: result.failed ?? 0 };
}