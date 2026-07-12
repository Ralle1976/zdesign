import { NextRequest, NextResponse } from 'next/server';
import { generateImageWithProvider } from '@/lib/ai/image-providers';

// Unified image-generation entry point.
//
// Multi-provider (2026-07): the client passes `provider` (selected in the
// settings UI). We dispatch to the matching adapter; if the user-selected
// provider fails OR no provider is specified, the dispatch layer falls
// through: configured paid providers → Pollinations (free, no key).
//
// Returns { url, provider, model, free } — the renderer interpolates url
// into background-image: url(...) unchanged.

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size, style, provider, model } = body as {
      prompt: string;
      size?: string;
      style?: string;
      provider?: string;
      model?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const imageSize = pickSize(size);
    const result = await generateImageWithProvider(prompt.trim(), {
      provider,
      size: imageSize,
      style,
      model,
    });

    if (!result) {
      return NextResponse.json(
        { error: 'Image generation unavailable (no provider succeeded)' },
        { status: 502 },
      );
    }

    return NextResponse.json({
      url: result.url,
      provider: result.provider,
      model: result.model,
      free: result.free,
      prompt,
      size: imageSize,
      style: style || 'photorealistic',
    });
  } catch (error: unknown) {
    console.error('[Image Generation API] Error:', error);
    const message = error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
