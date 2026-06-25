// Z.Design — FLUX image generation via Replicate
//
// Generates bespoke, concept-specific images that REPLACE generic Unsplash
// stock photos. The batch/generate pipeline calls this BEFORE or AFTER HTML
// generation to produce real Thai-food (or any topic) imagery that matches
// the design concept — no more burgers where pad thai should be.
//
// Pricing: FLUX Schnell ~$0.003/image · FLUX Dev ~$0.025/image
// API: POST https://api.replicate.com/v1/predictions
// Auth: Bearer $REPLICATE_API_TOKEN

const REPLICATE_BASE = 'https://api.replicate.com/v1/predictions';

export interface ImageGenOpts {
  model?: string;        // default: flux-schnell
  width?: number;        // default: 1024
  height?: number;       // default: 1024
  numOutputs?: number;   // default: 1
  timeoutMs?: number;   // default: 60000
}

export interface GeneratedImage {
  url: string;           // Replicate CDN URL (valid ~1h, download for permanent)
  prompt: string;
  model: string;
}

/**
 * Check if Replicate is configured (token present).
 */
export function isImageGenConfigured(): boolean {
  return !!process.env.REPLICATE_API_TOKEN;
}

/**
 * Generate a single image from a text prompt via Replicate FLUX.
 * Returns the CDN URL or throws on failure.
 *
 * Example: generateImage("Professional food photography of Pad Thai with
 * lime and peanuts, warm lighting, top-down, rustic table")
 */
export async function generateImage(
  prompt: string,
  opts: ImageGenOpts = {},
): Promise<GeneratedImage> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN not set. Get one at https://replicate.com/account/api-tokens');
  }

  const model = opts.model || 'black-forest-labs/flux-schnell';
  const width = opts.width || 1024;
  const height = opts.height || 1024;
  const numOutputs = opts.numOutputs || 1;
  const timeoutMs = opts.timeoutMs || 60_000;

  // Create prediction
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const createRes = await fetch(REPLICATE_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait=60', // Wait up to 60s for result (Replicate long-poll)
      },
      body: JSON.stringify({
        input: {
          prompt,
          width,
          height,
          num_outputs: numOutputs,
        },
        model,
      }),
      signal: controller.signal,
    });

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => '');
      throw new Error(`Replicate error ${createRes.status}: ${errText.slice(0, 200)}`);
    }

    const prediction = await createRes.json();

    // With Prefer: wait, the prediction may already be complete
    let status = prediction.status;
    let output = prediction.output;

    // If still processing, poll (shouldn't happen with Prefer: wait, but fallback)
    let polls = 0;
    while (status === 'starting' || status === 'processing') {
      if (polls++ > 30) throw new Error('Replicate timeout (image generation took too long)');
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(prediction.urls?.get || '', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (pollRes.ok) {
        const pollData = await pollRes.json();
        status = pollData.status;
        output = pollData.output;
      }
    }

    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Replicate prediction ${status}: ${prediction.error || 'unknown'}`);
    }

    // Output is an array of URLs (or a single URL for some models)
    const urls: string[] = Array.isArray(output) ? output : output ? [output] : [];
    if (urls.length === 0) {
      throw new Error('Replicate returned no image URL');
    }

    return {
      url: urls[0],
      prompt,
      model,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate multiple images from prompts (parallel, with concurrency limit).
 * Returns array of GeneratedImage (one per prompt, in order).
 */
export async function generateImages(
  prompts: string[],
  opts?: ImageGenOpts,
  concurrency = 3,
): Promise<GeneratedImage[]> {
  const results: GeneratedImage[] = new Array(prompts.length);
  let cursor = 0;

  async function worker() {
    while (cursor < prompts.length) {
      const i = cursor++;
      try {
        results[i] = await generateImage(prompts[i], opts);
      } catch (e) {
        console.error(`[image-replicate] failed for prompt ${i}:`, e instanceof Error ? e.message : e);
        // Return a fallback (empty URL — the HTML will show a CSS gradient placeholder)
        results[i] = { url: '', prompt: prompts[i], model: opts?.model || 'flux-schnell' };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, prompts.length) }, () => worker()),
  );
  return results;
}

/**
 * Build food-photography prompts from a brief's imagery field.
 * Produces 3-5 specific dish prompts that FLUX can render photorealistically.
 */
export function buildFoodImagePrompts(imagery: string, theme: string): string[] {
  // Extract key food items from the imagery/theme
  const combined = `${theme} ${imagery}`.toLowerCase();

  const prompts: string[] = [];

  // Always include a hero shot
  prompts.push(
    `Professional food photography, overhead shot of authentic Thai dishes on a rustic wooden table, warm natural lighting, steam rising, fresh herbs and lime garnish, appetizing, high resolution, ${theme}`,
  );

  // Add specific dishes based on keywords
  if (combined.includes('pad thai') || combined.includes('noodle') || combined.includes('street')) {
    prompts.push(
      `Close-up of Pad Thai noodles in a wok with shrimp, bean sprouts, crushed peanuts and lime wedge, street food style, dramatic warm lighting, motion blur on the wok toss, professional food photography`,
    );
  }
  if (combined.includes('curry') || combined.includes('green') || combined.includes('red')) {
    prompts.push(
      `Thai green curry in a ceramic bowl with jasmine rice on the side, fresh Thai basil leaves, coconut milk sauce, steam rising, rustic table setting, overhead food photography, warm tones`,
    );
  }
  if (combined.includes('satay') || combined.includes('grill') || combined.includes('skewer')) {
    prompts.push(
      `Chicken satay skewers on a charcoal grill with peanut dipping sauce, cucumber relish, smoke rising from the grill, close-up food photography, warm golden hour lighting`,
    );
  }
  if (combined.includes('mango') || combined.includes('sticky rice') || combined.includes('dessert')) {
    prompts.push(
      `Mango sticky rice dessert with coconut cream drizzle, fresh mango slices, toasted sesame, on a banana leaf, bright clean food photography, soft natural light`,
    );
  }
  if (combined.includes('spring roll') || combined.includes('frühlingsroll') || combined.includes('fried')) {
    prompts.push(
      `Golden crispy Thai spring rolls with sweet chili dipping sauce, fresh garnish, on a ceramic plate, close-up food photography, warm appetizing lighting`,
    );
  }

  // Fallback: always at least 3 images
  while (prompts.length < 3) {
    prompts.push(
      `Authentic Thai street food spread with multiple dishes, colorful and fresh, warm lighting, professional overhead food photography, ${theme}`,
    );
  }

  return prompts.slice(0, 5); // Max 5 images per design
}
