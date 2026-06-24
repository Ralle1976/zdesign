import { NextRequest, NextResponse } from 'next/server';
import { ProviderRegistry } from '@/lib/ai/providers/registry';

// Unified image-generation entry point.
// Tries the direct provider adapters (Z.ai CogView -> Minimax, via the registry,
// 429-rotation) first — works when Z.Design has provider keys configured.
// Falls back to the external Fusion service's /api/v1/image (its OWN keys) —
// the path that works locally, where Z.Design has no image keys.
// Returns { url } where url may be a remote URL or a data: URI — the renderer
// interpolates it into background-image: url(...) unchanged.

const FUSION_TIMEOUT_MS = 100_000;

const VALID_SIZES = [
  '1024x1024',
  '1344x768',
  '768x1344',
  '1152x864',
  '864x1152',
  '512x512',
  '768x512',
  '512x768',
];

function pickSize(size?: string): string {
  return size && VALID_SIZES.includes(size) ? size : '1024x1024';
}

/** Direct providers via the registry (Z.ai -> Minimax rotation). Null on any failure. */
async function generateViaRegistry(prompt: string, size: string): Promise<string | null> {
  try {
    const registry = ProviderRegistry.getInstance();
    const res = await registry.generateImage({ prompt, size });
    if (res?.url) return res.url;
  } catch (e) {
    console.warn(
      '[design/image] registry unavailable:',
      e instanceof Error ? e.message : e,
    );
  }
  return null;
}

/** External Fusion service (its own Z.ai/Minimax keys). Null on failure / not configured. */
async function generateViaFusion(prompt: string, size: string): Promise<string | null> {
  const base = process.env.FUSION_SERVICE_URL;
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FUSION_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/+$/, '')}/api/v1/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'minimax', prompt, size }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data?.url ?? null;
  } catch (e) {
    console.warn(
      '[design/image] fusion image unavailable:',
      e instanceof Error ? e.message : e,
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size, style } = body as {
      prompt: string;
      size?: string;
      style?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imageSize = pickSize(size);
    let enhancedPrompt = prompt.trim();
    if (style && style !== 'photorealistic') {
      enhancedPrompt = `${style} style: ${enhancedPrompt}`;
    }

    // 1) direct providers, then 2) Fusion service fallback.
    let url = await generateViaRegistry(enhancedPrompt, imageSize);
    if (!url) url = await generateViaFusion(enhancedPrompt, imageSize);

    if (!url) {
      return NextResponse.json(
        { error: 'Image generation unavailable (no provider succeeded)' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url,
      prompt: enhancedPrompt,
      size: imageSize,
      style: style || 'photorealistic',
    });
  } catch (error: unknown) {
    console.error('[Image Generation API] Error:', error);
    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
