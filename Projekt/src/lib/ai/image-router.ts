// Z.Design — Multi-Provider Image Router
//
// Routes image generation requests through available providers in priority order.
// Each provider is tried in sequence; the first to succeed wins.
//
// Priority:
//   ① MiniMax image-01   (100-130/day free, already configured)
//   ② Higgsfield          (if HIGGSFIELD_API_TOKEN set)
//   ③ Replicate FLUX      (if REPLICATE_API_TOKEN set, $0.003/image)
//   ④ Unsplash fallback   (stock photo, last resort)
//
// Usage: generateImage("Pad Thai overhead, warm lighting") → GeneratedImage

import { generateImageMinimax, isMinimaxImageConfigured, type GeneratedImage } from './image-minimax';

export { type GeneratedImage } from './image-minimax';

interface ProviderResult {
  ok: boolean;
  image?: GeneratedImage;
  error?: string;
  provider: string;
}

async function tryMinimax(prompt: string): Promise<ProviderResult> {
  if (!isMinimaxImageConfigured()) return { ok: false, provider: 'minimax', error: 'not configured' };
  try {
    const img = await generateImageMinimax(prompt);
    return { ok: true, image: img, provider: 'minimax' };
  } catch (e) {
    return { ok: false, provider: 'minimax', error: e instanceof Error ? e.message : String(e) };
  }
}

async function tryHiggsfield(prompt: string): Promise<ProviderResult> {
  const token = process.env.HIGGSFIELD_API_TOKEN;
  if (!token) return { ok: false, provider: 'higgsfield', error: 'not configured' };
  // Higgsfield REST API (when available) — stub for now, will be wired when user signs up
  // For now, fall through to next provider
  return { ok: false, provider: 'higgsfield', error: 'not yet wired (needs signup)' };
}

async function tryReplicate(prompt: string): Promise<ProviderResult> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) return { ok: false, provider: 'replicate', error: 'not configured' };
  try {
    // Dynamic import to avoid loading if not needed
    const { generateImage } = await import('./image-replicate');
    const img = await generateImage(prompt);
    return { ok: true, image: { ...img, provider: 'replicate' }, provider: 'replicate' };
  } catch (e) {
    return { ok: false, provider: 'replicate', error: e instanceof Error ? e.message : String(e) };
  }
}

function unsplashFallback(prompt: string): GeneratedImage {
  // Extract key food terms for a targeted Unsplash search
  const terms = prompt.toLowerCase().match(/(pad thai|curry|satay|mango|spring roll|noodle|thai food|food|dish)/g) || ['thai food'];
  const term = terms[0].replace(/\s+/g, '-');
  return {
    url: `https://source.unsplash.com/800x600/?${encodeURIComponent(term)}`,
    prompt,
    model: 'unsplash-fallback',
    provider: 'unsplash',
  };
}

/**
 * Generate an image using the best available provider.
 * Tries MiniMax → Higgsfield → Replicate → Unsplash fallback.
 * NEVER throws — always returns a GeneratedImage (fallback if all fail).
 */
export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const providers = [
    () => tryMinimax(prompt),
    () => tryHiggsfield(prompt),
    () => tryReplicate(prompt),
  ];

  for (const tryProvider of providers) {
    const result = await tryProvider();
    if (result.ok && result.image) {
      console.log(`[image-router] ${result.provider}: OK`);
      return result.image;
    }
    console.warn(`[image-router] ${result.provider}: ${result.error?.slice(0, 80)}`);
  }

  // All providers failed — Unsplash fallback
  console.warn('[image-router] all providers failed, using Unsplash fallback');
  return unsplashFallback(prompt);
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
 * Check which providers are configured.
 */
export function getConfiguredProviders(): string[] {
  const configured: string[] = [];
  if (isMinimaxImageConfigured()) configured.push('minimax (image-01)');
  if (process.env.HIGGSFIELD_API_TOKEN) configured.push('higgsfield');
  if (process.env.REPLICATE_API_TOKEN) configured.push('replicate (FLUX)');
  return configured;
}
