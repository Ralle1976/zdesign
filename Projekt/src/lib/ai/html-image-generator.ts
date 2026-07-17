// Z.Design — HTML Image Generator
//
// Post-processing step for Cream-generated HTML: replaces generic Unsplash
// stock photos with individually generated images that match the design's
// domain and each image's local context (alt text, surrounding heading).
//
// Flow:
//   1. Parse all <img src="unsplash..."> tags from the HTML
//   2. For each image, derive a generation prompt from:
//      - The design's domain (e.g. "bakery" → food photography style)
//      - The image's alt text (e.g. "fresh sourdough bread")
//      - The nearest heading (e.g. "Our Breads" → context)
//   3. Call generateImageWithProvider (Pollinations by default) in parallel
//   4. Replace each Unsplash URL with the generated image URL
//
// This makes every design visually unique instead of using identical stock photos.

import { generateImageWithProvider } from '@/lib/ai/image-providers';
import { getActiveImageProvider } from '@/lib/ai/call-text-llm';
import {
  buildHarmonizedImagePrompt,
  imageStyleSeed,
  type ImageHarmonyContext,
} from '@/lib/ai/image-harmony';
import type { DesignPalette } from '@/lib/ai/fusion/design-direction';

interface ImageReplacement {
  originalSrc: string;
  newSrc: string | null;
  alt: string;
  context: string;
}

/**
 * Extract context for each image from the HTML structure.
 * Returns the alt text and nearest preceding heading for each <img>.
 */
function extractImageContexts(html: string): Array<{ src: string; alt: string; context: string }> {
  const images: Array<{ src: string; alt: string; context: string }> = [];

  // Match all <img> tags
  const imgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const headingRegex = /<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi;

  // Build a map of heading positions for context lookup
  const headings: Array<{ pos: number; text: string }> = [];
  let hMatch;
  while ((hMatch = headingRegex.exec(html)) !== null) {
    headings.push({ pos: hMatch.index, text: hMatch[1].trim() });
  }

  let imgMatch;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const fullTag = imgMatch[0];
    const src = imgMatch[1];
    const imgPos = imgMatch.index;

    // Extract alt text
    const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
    const alt = altMatch ? altMatch[1] : '';

    // Find the nearest preceding heading
    let nearestHeading = '';
    for (const h of headings) {
      if (h.pos < imgPos) {
        nearestHeading = h.text;
      } else {
        break;
      }
    }

    images.push({ src, alt, context: nearestHeading });
  }

  return images;
}

/**
 * Build a generation prompt for an image based on domain + context.
 * Combines the domain's photographic style with the specific subject.
 */
function buildImagePrompt(
  domain: string,
  alt: string,
  context: string,
  harmony?: Pick<ImageHarmonyContext, 'mood' | 'palette' | 'styleSeed'>,
): string {
  const subject = alt || context || domain;
  if (harmony?.palette) {
    return buildHarmonizedImagePrompt(subject, {
      domain,
      mood: harmony.mood,
      palette: harmony.palette,
      styleSeed: harmony.styleSeed,
    });
  }
  return `${subject}. ${getDomainStyle(domain)}`;
}

function getDomainStyle(domain: string): string {
  if (domain.includes('food') || domain.includes('coffee')) {
    return 'Professional food photography, soft natural side lighting, shallow depth of field with creamy bokeh, appetizing warm tones, steam and freshness visible, shot on 85mm macro lens f/2.8, styled by a food stylist, high-end editorial quality';
  }
  if (domain.includes('spa') || domain.includes('wellness') || domain.includes('health')) {
    return 'Serene wellness photography, soft diffused lighting, calming natural tones, tranquil atmosphere, professional spa photography, shallow depth of field, editorial quality';
  }
  if (domain.includes('fashion') || domain.includes('beauty')) {
    return 'High fashion editorial photography, dramatic studio lighting, elegant composition, luxury aesthetic, shot on medium format, professional model, magazine quality';
  }
  if (domain.includes('law') || domain.includes('finance') || domain.includes('corporate')) {
    return 'Professional corporate photography, confident and trustworthy, soft office lighting, business appropriate, editorial quality, shot on 50mm f/2.8';
  }
  if (domain.includes('fitness') || domain.includes('gym')) {
    return 'Dynamic fitness photography, energetic lighting, athletic and motivational, professional sports photography, dramatic shadows, editorial quality';
  }
  if (domain.includes('crypto') || domain.includes('web3') || domain.includes('tech') || domain.includes('saas')) {
    return 'Modern tech product photography, dark background with subtle glow, clean composition, futuristic atmosphere, professional commercial quality';
  }
  if (domain.includes('travel') || domain.includes('nature')) {
    return 'Stunning landscape photography, golden hour lighting, wide-angle perspective, rich atmospheric tones, National Geographic quality, editorial grade';
  }
  if (domain.includes('portfolio') || domain.includes('creative')) {
    return 'Artistic photography, creative composition, dramatic lighting, professional portfolio quality, editorial aesthetic';
  }
  return 'Professional photography, dramatic lighting with soft shadows, high detail, sharp focus, rich colors, premium quality, editorial composition';
}

function isFreshTarget(src: string): boolean {
  if (!src || src.startsWith('data:')) return false;
  return /^https?:\/\//i.test(src);
}

/**
 * Replace Unsplash images (legacy path).
 */
export async function replaceImagesWithGenerated(
  html: string,
  domain: string,
  maxImages = 4,
  harmonyOpts?: { mood?: string; palette?: Partial<DesignPalette>; message?: string },
): Promise<{ html: string; replaced: number; failed: number }> {
  const imageContexts = extractImageContexts(html);
  const unsplashImages = imageContexts.filter((img) => img.src.includes('unsplash.com'));
  if (unsplashImages.length === 0) {
    return { html, replaced: 0, failed: 0 };
  }
  const toGenerate = unsplashImages.slice(0, maxImages);

  console.log(`[html-image-gen] Generating ${toGenerate.length} images for domain "${domain}"`);

  const imageProvider = await getActiveImageProvider();
  const styleSeed = imageStyleSeed(domain, harmonyOpts?.palette);

  const replacements: ImageReplacement[] = await Promise.all(
    toGenerate.map(async (img) => {
      const prompt = buildImagePrompt(domain, img.alt, img.context, {
        mood: harmonyOpts?.mood,
        palette: harmonyOpts?.palette,
        styleSeed,
      });
      try {
        const result = await generateImageWithProvider(prompt, {
          provider: imageProvider.id,
          model: imageProvider.model,
          size: '1024x768',
        });
        return {
          originalSrc: img.src,
          newSrc: result?.url ?? null,
          alt: img.alt,
          context: img.context,
        };
      } catch (err) {
        console.warn(`[html-image-gen] Failed for "${img.alt.slice(0, 40)}":`, err instanceof Error ? err.message : err);
        return { originalSrc: img.src, newSrc: null, alt: img.alt, context: img.context };
      }
    })
  );

  // Replace URLs in HTML
  let updatedHtml = html;
  let replaced = 0;
  let failed = 0;

  for (const r of replacements) {
    if (r.newSrc) {
      // Replace the specific Unsplash URL with the generated image URL.
      // Using split/join instead of replaceAll for broader compatibility.
      updatedHtml = updatedHtml.split(r.originalSrc).join(r.newSrc);
      replaced++;
    } else {
      failed++;
    }
  }

  console.log(`[html-image-gen] Done: ${replaced} replaced, ${failed} failed`);
  return { html: updatedHtml, replaced, failed };
}

/**
 * Replace ALL external images with freshly generated ones (every run = new photos).
 */
export async function replaceAllImagesWithFresh(
  html: string,
  domain: string,
  maxImages = 6,
  harmonyOpts?: {
    mood?: string;
    palette?: Partial<DesignPalette>;
    message?: string;
    uniqueRun?: boolean;
  },
): Promise<{ html: string; replaced: number; failed: number }> {
  const imageContexts = extractImageContexts(html).filter((img) => isFreshTarget(img.src));

  if (imageContexts.length === 0) {
    return { html, replaced: 0, failed: 0 };
  }

  const toGenerate = imageContexts.slice(0, maxImages);
  console.log(
    `[html-image-gen] Fresh pass: ${toGenerate.length} images for "${domain}"`,
  );

  const imageProvider = await getActiveImageProvider();
  const baseSeed = imageStyleSeed(domain, harmonyOpts?.palette);
  const runSalt = harmonyOpts?.uniqueRun ? `-${Date.now()}` : '';

  const replacements: ImageReplacement[] = await Promise.all(
    toGenerate.map(async (img, i) => {
      const prompt = buildImagePrompt(domain, img.alt || harmonyOpts?.message || domain, img.context, {
        mood: harmonyOpts?.mood,
        palette: harmonyOpts?.palette,
        styleSeed: `${baseSeed}-${i}${runSalt}`,
      });
      try {
        const result = await generateImageWithProvider(prompt, {
          provider: imageProvider.id,
          model: imageProvider.model,
          size: '1024x768',
        });
        return {
          originalSrc: img.src,
          newSrc: result?.url ?? null,
          alt: img.alt,
          context: img.context,
        };
      } catch (err) {
        console.warn(
          `[html-image-gen] Fresh gen failed for img ${i}:`,
          err instanceof Error ? err.message : err,
        );
        return { originalSrc: img.src, newSrc: null, alt: img.alt, context: img.context };
      }
    }),
  );

  let updatedHtml = html;
  let replaced = 0;
  let failed = 0;
  for (const r of replacements) {
    if (r.newSrc) {
      updatedHtml = updatedHtml.split(r.originalSrc).join(r.newSrc);
      replaced++;
    } else {
      failed++;
    }
  }

  console.log(`[html-image-gen] Fresh pass done: ${replaced} replaced, ${failed} failed`);
  return { html: updatedHtml, replaced, failed };
}
