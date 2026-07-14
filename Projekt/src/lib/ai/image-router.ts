// Z.Design — Legacy image router (now delegating to the multi-provider layer)
//
// Historical note: this file used to hardcode MiniMax → Higgsfield → Replicate.
// As of 2026-07, image generation is provider-pluggable via
// `src/lib/ai/image-providers.ts` (Pollinations free default + DeepInfra/fal/
// Replicate paid). This module is kept as a thin compatibility shim so any
// existing imports keep working; new code should call
// `generateImageWithProvider()` directly or POST /api/design/image.

import { generateImageWithProvider } from './image-providers';

export interface GeneratedImage {
  url: string;
  prompt: string;
  model?: string;
  provider: string;
  free?: boolean;
}

/**
 * Generate an image using the best available provider (user-configured, then
 * fallback chain, then Pollinations free). NEVER throws.
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const result = await generateImageWithProvider(prompt);
  if (result) {
    return {
      url: result.url,
      prompt,
      model: result.model,
      provider: result.provider,
      free: result.free,
    };
  }
  // Ultimate fallback — should never happen because Pollinations always works.
  return {
    url: `https://source.unsplash.com/1024x1024/?${encodeURIComponent(prompt.slice(0, 60))}`,
    prompt,
    model: 'unsplash-fallback',
    provider: 'unsplash',
  };
}

/**
 * Generate multiple images (parallel with concurrency).
 */
export async function generateImages(
  prompts: string[],
  concurrency = 3,
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = new Array(prompts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < prompts.length) {
      const i = cursor++;
      results[i] = await generateImage(prompts[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, prompts.length) }, () => worker()));
  return results;
}

/**
 * Check which providers are configured (for diagnostics / health UI).
 */
export function getConfiguredProviders(): string[] {
  const configured: string[] = ['pollinations (free)']; // always available
  if (process.env.DEEPINFRA_API_KEY) configured.push('deepinfra (Flux Schnell ~$0.0009)');
  if (process.env.FAL_KEY) configured.push('fal.ai (Flux Schnell ~$0.001)');
  if (process.env.REPLICATE_API_TOKEN) configured.push('replicate (Flux Schnell ~$0.003)');
  return configured;
}
