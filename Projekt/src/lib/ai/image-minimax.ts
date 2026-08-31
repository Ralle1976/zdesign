// Z.Design — MiniMax image-01 client
//
// PRIMARY image provider. The MiniMax coding plan key (already in .env)
// generates ~100-130 images/day at no extra cost. Model "image-01" produces
// photorealistic food/design photography from text prompts.
//
// API: POST https://api.minimax.io/v1/image_generation
// Auth: Bearer $MINIMAX_API_KEY (same key as the text LLM)
// Response: { data: { image_urls: ["https://..."] }, base_resp: { status_code: 0 } }
//
// Prompt builders live in image-prompts.ts (re-exported below for backward
// compatibility with older imports).

export interface MinimaxImageOpts {
  model?: string;        // default: image-01
  aspectRatio?: string; // default: "4:3" (options: "1:1", "4:3", "16:9", "3:4", "9:16")
  numImages?: number;    // default: 1
  timeoutMs?: number;   // default: 60000
}

export interface GeneratedImage {
  url: string;
  prompt: string;
  model: string;
  provider: string;
}

import { getProviderById, readProviderKey } from '@/lib/ai/provider-config';
import { buildImagePrompts, buildThaiFoodPrompts } from '@/lib/ai/image-prompts';

// Re-export prompt builders — kept here so existing importers don't break.
export { buildImagePrompts, buildThaiFoodPrompts };

function minimaxKey(): string | undefined {
  const p = getProviderById('minimax');
  return p ? readProviderKey(p) : process.env.MINIMAX_API_KEY?.trim();
}

export function isMinimaxImageConfigured(): boolean {
  return !!minimaxKey();
}

export async function generateImageMinimax(
  prompt: string,
  opts: MinimaxImageOpts = {},
): Promise<GeneratedImage> {
  const key = minimaxKey();
  if (!key) throw new Error('MINIMAX_API_KEY not set');

  const model = opts.model || 'image-01';
  const aspectRatio = opts.aspectRatio || '4:3';
  const numImages = opts.numImages || 1;
  const timeoutMs = opts.timeoutMs || 60_000;

  // Retry once on network-level failures (fetch failed / abort) — batch runs
  // showed intermittent "fetch failed" against the MiniMax API.
  const MAX_ATTEMPTS = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch('https://api.minimax.io/v1/image_generation', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          prompt,
          aspect_ratio: aspectRatio,
          num_images: numImages,
          response_format: 'url',
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`MiniMax image error ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const status = data?.base_resp?.status_code ?? -1;
      if (status !== 0) {
        throw new Error(`MiniMax image failed: ${data?.base_resp?.status_msg || JSON.stringify(data).slice(0, 200)}`);
      }

      const urls: string[] = data?.data?.image_urls || [];
      if (urls.length === 0) {
        throw new Error('MiniMax returned no image URLs');
      }

      return {
        url: urls[0],
        prompt,
        model,
        provider: 'minimax',
      };
    } catch (e) {
      lastError = e;
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[image-minimax] attempt ${attempt} failed, retrying:`, e instanceof Error ? e.message : e);
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/**
 * Generate multiple images in parallel (with concurrency limit).
 */
export async function generateImagesMinimax(
  prompts: string[],
  opts?: MinimaxImageOpts,
  concurrency = 3,
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = new Array(prompts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < prompts.length) {
      const i = cursor++;
      try {
        results[i] = await generateImageMinimax(prompts[i], opts);
      } catch (e) {
        console.error(`[image-minimax] failed for prompt ${i}:`, e instanceof Error ? e.message : e);
        results[i] = { url: '', prompt: prompts[i], model: opts?.model || 'image-01', provider: 'minimax' };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, () => worker()));
  return results;
}
