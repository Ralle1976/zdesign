// Z.Design — Multi-provider image generation layer
//
// Slim, dedicated image adapters (one function per provider). This lives
// separately from the heavyweight ai/providers/registry.ts because:
//   - image gen is a single request/response (no streaming, no rate-limit rotation needed)
//   - Pollinations needs no auth and thus doesn't fit the adapter pattern
//   - providers have very different APIs (OpenAI-compatible, fal.queue, raw GET)
//
// Each adapter: (prompt, size, model?) => Promise<{ url } | null>
// Returns null on failure (NEVER throws) so the caller can fall through.
//
// Pricing (per 1024x1024 image, as of 2026-07):
//   pollinations:  FREE (no key, ~unlimited, ad-supported tier)
//   deepinfra:     ~$0.0009/image  (Flux Schnell) — cheapest paid
//   fal.ai:        ~$0.001-0.003/image (Flux Schnell)
//   replicate:     ~$0.003/image   (Flux Schnell)
//
// Usage:
//   const { url } = await generateImageWithProvider(prompt, {
//     provider: 'deepinfra',        // user-selected
//     size: '1024x1024',
//     model: 'flux-schnell',
//   });

import type { ProviderConfig } from '@/lib/providers/registry';

// ============ Prompt enrichment ============
// Flux (and most image models) produce flat, generic results from a bare subject
// description like "rustic bread loaf". Professional photography keywords are
// needed for: depth of field, appetizing lighting, color richness, premium feel.
// This function enriches WITHOUT diluting the LLM's specific subject.

const FOOD_KEYWORDS = /\b(bread|loaf|croissant|cake|pastry|bakery|coffee|dish|food|meal|dessert|cuisine|restaurant|plate|drink|beverage|wine|cocktail|breakfast|brunch|dinner|lunch|appetizer|ingredient|fruit|vegetable|meat|seafood|chocolate|cheese|soup|salad|pizza|burger|sandwich|ice cream|gelato|confection|treat|delicacy|bakery|patisserie|boulangerie)\b/i;

const PRODUCT_KEYWORDS = /\b(product|bottle|package|box|device|phone|laptop|watch|sneaker|shoe|bag|purse|wallet|glasses|jewelry|ring|necklace|earrings|perfume|cosmetic|skincare|furniture|chair|lamp|sofa|table|chair|decor|accessory|fashion|apparel|garment|clothing|wear|model wearing)\b/i;

const PORTRAIT_KEYWORDS = /\b(person|people|woman|man|model|portrait|face|smile|worker|chef|barista|artisan|craftsman|professional|team|group|customer|client)\b/i;

const LANDSCAPE_KEYWORDS = /\b(landscape|nature|mountain|forest|ocean|beach|sunset|sunrise|sky|clouds|field|meadow|garden|park|cityscape|skyline|street|architecture|building|interior|room|office|studio|space|venue|resort|spa|hotel|lobby)\b/i;

function enrichImagePrompt(prompt: string): string {
  // Don't double-enrich: if the prompt already has professional markers, leave it.
  if (/\b(85mm|f\/1\.|depth of field|bokeh|professional|studio lighting|color graded|high-end commercial)\b/i.test(prompt)) {
    return prompt;
  }

  const isFood = FOOD_KEYWORDS.test(prompt);
  const isProduct = PRODUCT_KEYWORDS.test(prompt);
  const isPortrait = PORTRAIT_KEYWORDS.test(prompt);
  const isLandscape = LANDSCAPE_KEYWORDS.test(prompt);

  // Build subject-specific enrichment
  const enrichment: string[] = [];

  if (isFood) {
    enrichment.push(
      'professional food photography',
      'soft natural window light from the side',
      'shallow depth of field with creamy bokeh',
      'appetizing colors, steam and freshness visible',
      'shot on 85mm macro lens, f/2.8',
      'garnished and styled by a food stylist',
      'warm inviting tones, high-end editorial quality'
    );
  } else if (isProduct) {
    enrichment.push(
      'professional product photography',
      'softbox studio lighting with subtle reflections',
      'clean composition, premium commercial quality',
      'shot on 100mm macro, f/8, crisp detail',
      'elegant shadows and highlights',
      'high-end advertising aesthetic'
    );
  } else if (isPortrait) {
    enrichment.push(
      'professional portrait photography',
      'soft Rembrandt lighting',
      'shallow depth of field, blurred background',
      'shot on 85mm portrait lens, f/1.8',
      'natural authentic expression',
      'cinematic color grading'
    );
  } else if (isLandscape) {
    enrichment.push(
      'professional architectural photography',
      'golden hour natural lighting',
      'wide-angle perspective with depth',
      'shot on 24mm lens, f/8',
      'rich atmospheric tones',
      'editorial quality, magazine-grade'
    );
  } else {
    // Generic enrichment for abstract/unknown subjects
    enrichment.push(
      'professional photography',
      'dramatic lighting with soft shadows',
      'high detail, sharp focus',
      'rich colors, premium quality',
      'editorial composition'
    );
  }

  // Combine: subject first (preserves LLM intent), then enrichment
  const result = `${prompt}, ${enrichment.join(', ')}`;
  // Cap at 480 chars (Pollinations limit is 500, leave margin)
  return result.slice(0, 480);
}

// ============ Types ============

export interface ImageGenOptions {
  /** Provider id (must exist in the registry catalogue). */
  provider?: string;
  /** Target size; defaults to 1024x1024. */
  size?: string;
  /** Model id within the provider; provider default if omitted. */
  model?: string;
  /** Optional style prefix applied to the prompt. */
  style?: string;
}

export interface ImageGenSuccess {
  url: string;
  provider: string;
  model?: string;
  /** True if the image came from a free tier (for observability/cost). */
  free: boolean;
}

// ============ Provider adapters ============
// Each returns { url } on success or null on any failure. Never throws.

const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt';

async function pollinationsImage(prompt: string, size: string): Promise<ImageGenSuccess | null> {
  // Pollinations: FREE, no API key. The URL itself IS the image — it generates
  // on-demand when the browser/renderer GETs it. We return the URL directly
  // and let the client load it (no bytes fetched server-side, no HEAD probe).
  //
  // We deliberately do NOT probe with a HEAD/GET here: Pollinations' HEAD
  // responses are inconsistent (redirects, 500s on HEAD even when GET works),
  // and a GET would fetch the whole image bytes just to discard them. The
  // client's <img onError> is the proper failure signal.
  try {
    const [w, h] = size.split('x').map((n) => parseInt(n, 10) || 1024);
    const seed = Math.floor(Math.random() * 1_000_000);
    const params = new URLSearchParams({
      width: String(w),
      height: String(h),
      seed: String(seed),
      nologo: 'true',
      model: 'flux', // Pollinations' free Flux variant
    });
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt.slice(0, 500))}?${params}`;
    return { url, provider: 'pollinations', model: 'flux', free: true };
  } catch {
    return null;
  }
}

const DEEPINFRA_BASE = 'https://api.deepinfra.com/v1/openai/images/generations';

async function deepinfraImage(
  prompt: string,
  size: string,
  model: string,
  apiKey: string
): Promise<ImageGenSuccess | null> {
  // DeepInfra exposes an OpenAI-compatible images endpoint. Cheapest paid
  // Flux Schnell hosting (~$0.0009/image). Returns base64 or URL.
  try {
    const res = await fetch(DEEPINFRA_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'black-forest-labs/FLUX-1-schnell',
        prompt,
        size,
        n: 1,
        response_format: 'url',
      }),
    });
    if (!res.ok) {
      console.warn('[image-providers] deepinfra non-OK:', res.status);
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
    const first = data.data?.[0];
    if (!first) return null;
    const url = first.url ?? (first.b64_json ? `data:image/png;base64,${first.b64_json}` : null);
    if (!url) return null;
    return { url, provider: 'deepinfra', model, free: false };
  } catch (e) {
    console.warn('[image-providers] deepinfra failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function falImage(
  prompt: string,
  size: string,
  model: string,
  apiKey: string
): Promise<ImageGenSuccess | null> {
  // fal.ai: POST to https://fal.run/{model_id} with Authorization: Key {FAL_KEY}.
  // Returns { image: { url } } or { images: [{ url }] }.
  try {
    const modelId = model || 'fal-ai/flux/schnell';
    const [w, h] = size.split('x').map((n) => parseInt(n, 10) || 1024);
    const res = await fetch(`https://fal.run/${modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        image_size: { width: w, height: h },
        num_inference_steps: 4, // schnell = 4 steps (fast + cheap)
      }),
    });
    if (!res.ok) {
      console.warn('[image-providers] fal non-OK:', res.status);
      return null;
    }
    const data = (await res.json()) as {
      image?: { url?: string };
      images?: Array<{ url?: string }>;
    };
    const url = data.image?.url ?? data.images?.[0]?.url;
    if (!url) return null;
    return { url, provider: 'fal', model: modelId, free: false };
  } catch (e) {
    console.warn('[image-providers] fal failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function replicateImage(
  prompt: string,
  size: string,
  model: string,
  apiKey: string
): Promise<ImageGenSuccess | null> {
  // Replicate: POST /v1/predictions, then poll until completed.
  // Model format: "owner/model" or version hash.
  try {
    const modelId = model || 'black-forest-labs/flux-schnell';
    const createRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        Prefer: 'wait', // synchronous mode (wait for completion, up to 60s)
      },
      body: JSON.stringify({
        input: { prompt, image_dimensions: size, num_inference_steps: 4 },
      }),
    });
    if (!createRes.ok) {
      // Replicate needs a version ref; fall back to the deployments endpoint
      // shape used by models. If the bare call fails, return null.
      console.warn('[image-providers] replicate non-OK:', createRes.status);
      return null;
    }
    const prediction = (await createRes.json()) as {
      status: string;
      output?: string | string[];
      error?: string;
    };
    if (prediction.status !== 'succeeded') {
      console.warn('[image-providers] replicate status:', prediction.status);
      return null;
    }
    const output = prediction.output;
    const url = Array.isArray(output) ? output[0] : output;
    if (!url || typeof url !== 'string') return null;
    return { url, provider: 'replicate', model: modelId, free: false };
  } catch (e) {
    console.warn('[image-providers] replicate failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ============ Dispatch ============

/**
 * Generate an image via the user-selected provider. Falls back to a chain
 * (user selection → other configured paid providers → Pollinations free)
 * so the user always gets an image back even if their primary choice fails.
 */
export async function generateImageWithProvider(
  prompt: string,
  opts: ImageGenOptions = {}
): Promise<ImageGenSuccess | null> {
  const size = opts.size && /^\d+x\d+$/.test(opts.size) ? opts.size : '1024x1024';
  // Don't prepend mood tokens ("warm · handwerklich · eingeladen") to image
  // prompts — they confuse the image model and dilute the actual subject.
  // Instead, ENRICH the LLM's subject description with professional photography
  // styling that Flux needs to produce appetizing, premium results (without this,
  // Flux produces flat, dry, overbaked images that look like stock placeholders).
  const enhanced = enrichImagePrompt(prompt.trim());

  const has = (k?: string): k is string => !!k && !!process.env[k] && process.env[k]!.trim().length > 0;

  // Build the ordered list of providers to try.
  // 1. User-selected provider first (if configured).
  // 2. Then any other configured paid providers.
  // 3. Finally Pollinations (always available, free, no key).
  type Candidate = { id: string; run: () => Promise<ImageGenSuccess | null> };
  const candidates: Candidate[] = [];

  const addDeepinfra = () =>
    candidates.push({
      id: 'deepinfra',
      run: () => deepinfraImage(enhanced, size, opts.model ?? 'black-forest-labs/FLUX-1-schnell', process.env.DEEPINFRA_API_KEY!),
    });
  const addFal = () =>
    candidates.push({
      id: 'fal',
      run: () => falImage(enhanced, size, opts.model ?? 'fal-ai/flux/schnell', process.env.FAL_KEY!),
    });
  const addReplicate = () =>
    candidates.push({
      id: 'replicate',
      run: () => replicateImage(enhanced, size, opts.model ?? 'black-forest-labs/flux-schnell', process.env.REPLICATE_API_TOKEN!),
    });

  // User selection first.
  const sel = opts.provider;
  if (sel === 'deepinfra' && has('DEEPINFRA_API_KEY')) addDeepinfra();
  else if (sel === 'fal' && has('FAL_KEY')) addFal();
  else if (sel === 'replicate' && has('REPLICATE_API_TOKEN')) addReplicate();
  else if (sel === 'pollinations') {
    // Explicit free selection — still goes first.
  }

  // Other configured providers as fallback (in cost order: cheapest first).
  if (sel !== 'deepinfra' && has('DEEPINFRA_API_KEY')) addDeepinfra();
  if (sel !== 'fal' && has('FAL_KEY')) addFal();
  if (sel !== 'replicate' && has('REPLICATE_API_TOKEN')) addReplicate();

  // Pollinations always last (free, no key, slower).
  candidates.push({ id: 'pollinations', run: () => pollinationsImage(enhanced, size) });

  // Try each candidate in order; return the first success.
  for (const c of candidates) {
    const result = await c.run();
    if (result) return result;
  }

  return null;
}

// ============ Provider catalogue enrichment ============
// Declares the new providers for the settings UI / capabilities manifest.
// Imported by providers/registry.ts via the export below.

export interface ImageProviderCatalogueEntry {
  id: string;
  name: string;
  models: Array<{ id: string; label: string; pricing?: string }>;
  apiKeyEnv?: string;
  endpoint?: string;
  quota?: string;
  /** True if no API key is required (always available). */
  free?: boolean;
  /** Default model selected. */
  defaultModel: string;
}

export const IMAGE_PROVIDER_CATALOGUE: ImageProviderCatalogueEntry[] = [
  {
    id: 'pollinations',
    name: 'Pollinations (Free)',
    models: [{ id: 'flux', label: 'Flux (free tier)', pricing: 'FREE' }],
    endpoint: 'https://image.pollinations.ai',
    quota: '~unlimited, no key required',
    free: true,
    defaultModel: 'flux',
  },
  {
    id: 'deepinfra',
    name: 'DeepInfra',
    models: [
      { id: 'black-forest-labs/FLUX-1-schnell', label: 'Flux Schnell', pricing: '~$0.0009/img' },
      { id: 'stabilityai/sdxl', label: 'SDXL', pricing: '~$0.0006/img' },
    ],
    apiKeyEnv: 'DEEPINFRA_API_KEY',
    endpoint: 'https://api.deepinfra.com',
    quota: 'pay per image',
    defaultModel: 'black-forest-labs/FLUX-1-schnell',
  },
  {
    id: 'fal',
    name: 'fal.ai',
    models: [
      { id: 'fal-ai/flux/schnell', label: 'Flux Schnell', pricing: '~$0.001/img' },
      { id: 'fal-ai/flux/dev', label: 'Flux Dev', pricing: '~$0.025/img' },
    ],
    apiKeyEnv: 'FAL_KEY',
    endpoint: 'https://fal.run',
    quota: 'pay per image',
    defaultModel: 'fal-ai/flux/schnell',
  },
  {
    id: 'replicate',
    name: 'Replicate',
    models: [
      { id: 'black-forest-labs/flux-schnell', label: 'Flux Schnell', pricing: '~$0.003/img' },
      { id: 'black-forest-labs/flux-dev', label: 'Flux Dev', pricing: '~$0.025/img' },
    ],
    apiKeyEnv: 'REPLICATE_API_TOKEN',
    endpoint: 'https://api.replicate.com',
    quota: 'pay per image',
    defaultModel: 'black-forest-labs/flux-schnell',
  },
];
