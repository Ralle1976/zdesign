import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { prompt, size, style } = body as {
      prompt: string;
      size?: string;
      style?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Build enhanced prompt with style
    let enhancedPrompt = prompt.trim();
    if (style && style !== 'photorealistic') {
      enhancedPrompt = `${style} style: ${enhancedPrompt}`;
    }

    // Validate size (must be multiple of 32, 512-2880px)
    const validSizes = [
      '1024x1024',
      '1344x768',
      '768x1344',
      '1152x864',
      '864x1152',
      '512x512',
      '768x512',
      '512x768',
    ];
    const imageSize = size && validSizes.includes(size) ? size : '1024x1024';

    // Use z-ai-web-dev-sdk for image generation
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const result = await zai.images.generate({
      prompt: enhancedPrompt,
      size: imageSize,
    });

    // The result should contain image data (base64 or URL)
    const imageData = result.data?.[0] || result;
    const imageUrl =
      imageData?.url ||
      (imageData?.b64_json
        ? `data:image/png;base64,${imageData.b64_json}`
        : null);

    if (!imageUrl && !imageData?.b64_json) {
      return NextResponse.json(
        { error: 'Image generation returned no data' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: imageUrl || `data:image/png;base64,${imageData.b64_json}`,
      prompt: enhancedPrompt,
      size: imageSize,
      style: style || 'photorealistic',
    });
  } catch (error: unknown) {
    console.error('[Image Generation API] Error:', error);
    const message =
      error instanceof Error ? error.message : 'Image generation failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
