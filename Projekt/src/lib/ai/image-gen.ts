/**
 * Z.ai Image generation client (CogView-4 / GLM-Image).
 *
 * Posts to the Z.ai paas/v4 image-generations endpoint and returns the image URL.
 * Used for bespoke, concept-specific imagery (replacing Unsplash stock photos).
 *
 * Endpoint: https://api.z.ai/api/paas/v4/images/generations
 * Auth:     Bearer $ZAI_API_KEY
 *
 * For now this is the standalone client only — it is NOT yet wired into the
 * design-prompt pipeline. Call generateImage() from a node-image path later.
 */

const ZAI_IMAGE_URL =
  process.env.ZAI_IMAGE_URL ||
  'https://api.z.ai/api/paas/v4/images/generations';
const DEFAULT_MODEL = 'cogview-4';

export interface ZaiImageOptions {
  /** Image model id; defaults to 'cogview-4' (alt: 'glm-image'). */
  model?: string;
  /** Image size, e.g. '1024x1024', '1792x1024'. Provider-dependent. */
  size?: string;
  /** Number of images to request. Default 1. */
  n?: number;
  /** Per-request timeout in ms. Default 90_000 (image gen is slow). */
  timeoutMs?: number;
}

/**
 * Returns true when ZAI_API_KEY is present in the environment.
 * Gate UI affordances / node-image paths on this.
 */
export function isImageGenConfigured(): boolean {
  return Boolean(process.env.ZAI_API_KEY);
}

/**
 * Generate an image from a text prompt via Z.ai's image endpoint.
 *
 * @returns the image URL (hosted by Z.ai).
 * @throws Error if ZAI_API_KEY is missing or the request fails.
 */
export async function generateImage(
  prompt: string,
  opts: ZaiImageOptions = {},
): Promise<string> {
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ZAI_API_KEY is not configured. Set it to enable Z.ai image generation.',
    );
  }
  if (!prompt || !prompt.trim()) {
    throw new Error('generateImage: prompt is required');
  }

  const model = opts.model || DEFAULT_MODEL;
  const timeoutMs = opts.timeoutMs ?? 90_000;

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: opts.n ?? 1,
  };
  if (opts.size) body.size = opts.size;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(ZAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const data = (await res.json().catch(() => null)) as
    | {
        data?: Array<{ url?: string; b64_json?: string }>;
        url?: string;
        error?: { message?: string } | string;
      }
    | null;

  if (!res.ok) {
    const msg =
      (data?.error &&
        (typeof data.error === 'string' ? data.error : data.error.message)) ||
      `Z.ai image generation failed (status ${res.status})`;
    throw new Error(msg);
  }

  // Prefer the OpenAI-style { data: [{ url }] } envelope, then a top-level url.
  const url =
    data?.data?.[0]?.url ||
    data?.url ||
    (data?.data?.[0]?.b64_json
      ? `data:image/png;base64,${data.data[0].b64_json}`
      : '');

  if (!url) {
    throw new Error(
      'Z.ai image generation returned no image URL (unexpected response shape).',
    );
  }

  return url;
}
