// Z.Design - Provider Verification API
// Verifies AI provider connectivity and capabilities

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { providerId, apiKey, modelId } = body;

    if (!providerId) {
      return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
    }

    // For Z.ai (built-in), always verify as working
    if (providerId === 'z-ai') {
      try {
        const ZAI = (await import('z-ai-web-dev-sdk')).default;
        const zai = await ZAI.create();
        // Quick test: generate a tiny response
        const result = await Promise.race([
          zai.chat.completions.create({
            messages: [
              { role: 'system', content: 'Reply with only: OK' },
              { role: 'user', content: 'test' },
            ],
            thinking: { type: 'disabled' },
          }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000)),
        ]);

        const responseText = result.choices[0]?.message?.content;
        return NextResponse.json({
          providerId,
          modelId: modelId || 'z-ai-default',
          status: 'ok',
          capabilities: {
            text: true,
            vision: true,
            image: true,
            code: true,
          },
          responseTime: result.usage?.total_tokens ? 'fast' : 'normal',
          testResponse: responseText,
        });
      } catch (error) {
        return NextResponse.json({
          providerId,
          modelId: modelId || 'z-ai-default',
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }

    // For third-party providers, verify with their API
    if (!apiKey) {
      return NextResponse.json({
        providerId,
        status: 'no_key',
        capabilities: { text: false, vision: false, image: false, code: false },
        error: 'API key required for this provider',
      });
    }

    // Verify OpenAI
    if (providerId === 'openai') {
      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const models = data.data?.map((m: { id: string }) => m.id) || [];
          return NextResponse.json({
            providerId,
            status: 'ok',
            capabilities: {
              text: models.some((m: string) => m.includes('gpt')),
              vision: models.some((m: string) => m.includes('gpt-4o') || m.includes('gpt-4-turbo')),
              image: models.some((m: string) => m.includes('dall-e')),
              code: models.some((m: string) => m.includes('gpt')),
            },
            availableModels: models.slice(0, 20),
          });
        }
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: `API returned ${res.status}`,
        });
      } catch (error) {
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }

    // Verify Anthropic
    if (providerId === 'anthropic') {
      try {
        const res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const models = data.data?.map((m: { id: string }) => m.id) || [];
          return NextResponse.json({
            providerId,
            status: 'ok',
            capabilities: {
              text: models.some((m: string) => m.includes('claude')),
              vision: models.some((m: string) => m.includes('claude-3')),
              image: false,
              code: models.some((m: string) => m.includes('claude')),
            },
            availableModels: models.slice(0, 20),
          });
        }
        // Anthropic may return 401 or similar for invalid keys
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: `API returned ${res.status}`,
        });
      } catch (error) {
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }

    // Verify Google AI
    if (providerId === 'google') {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          const models = data.models?.map((m: { name: string }) => m.name) || [];
          return NextResponse.json({
            providerId,
            status: 'ok',
            capabilities: {
              text: models.some((m: string) => m.includes('gemini')),
              vision: models.some((m: string) => m.includes('vision') || m.includes('pro')),
              image: false,
              code: models.some((m: string) => m.includes('gemini')),
            },
            availableModels: models.slice(0, 20),
          });
        }
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: `API returned ${res.status}`,
        });
      } catch (error) {
        return NextResponse.json({
          providerId,
          status: 'error',
          capabilities: { text: false, vision: false, image: false, code: false },
          error: error instanceof Error ? error.message : 'Connection failed',
        });
      }
    }

    // Generic verification for other providers
    return NextResponse.json({
      providerId,
      status: 'unverified',
      capabilities: { text: false, vision: false, image: false, code: false },
      message: 'Verification not implemented for this provider yet',
    });
  } catch (error) {
    console.error('[Provider Verify API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify provider', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
