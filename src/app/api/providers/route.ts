import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - List all configured providers with rate limit info
export async function GET() {
  try {
    const providers = await db.aIProvider.findMany({
      orderBy: { priority: 'asc' },
    });

    // Mask API keys for security, include rate limit info
    const masked = providers.map((p) => ({
      ...p,
      apiKey: p.apiKey ? `${p.apiKey.substring(0, 8)}...${p.apiKey.slice(-4)}` : null,
      requestsRemaining: p.requestsLimit > 0 ? p.requestsLimit - p.requestsUsed : -1,
      tokensRemaining: p.tokensLimit > 0 ? p.tokensLimit - p.tokensUsed : -1,
    }));

    return NextResponse.json({ providers: masked });
  } catch (error) {
    console.error('[Providers API] GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}

// POST - Add a new provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      provider,
      apiKey,
      baseUrl,
      models,
      capabilities,
      isActive,
      priority,
      config,
      requestsLimit,
      tokensLimit,
    } = body;

    if (!name || !provider) {
      return NextResponse.json({ error: 'name and provider are required' }, { status: 400 });
    }

    const newProvider = await db.aIProvider.create({
      data: {
        name,
        provider,
        apiKey: apiKey || null,
        baseUrl: baseUrl || null,
        models: JSON.stringify(models || []),
        capabilities: JSON.stringify(capabilities || []),
        isActive: isActive ?? false,
        priority: priority ?? 99,
        config: JSON.stringify(config || {}),
        requestsLimit: requestsLimit ?? 0,
        tokensLimit: tokensLimit ?? 0,
      },
    });

    // If provider is set active, register it in the ProviderRegistry
    if (newProvider.isActive) {
      try {
        const { ProviderRegistry } = await import('@/lib/ai/providers');
        const registry = ProviderRegistry.getInstance();
        registry.registerProvider({
          id: newProvider.id,
          name: newProvider.name,
          provider: newProvider.provider as 'zai' | 'openai' | 'anthropic' | 'google' | 'stability' | 'replicate' | 'openrouter' | 'minimax' | 'custom',
          apiKey: newProvider.apiKey || undefined,
          baseUrl: newProvider.baseUrl || undefined,
          models: JSON.parse(newProvider.models),
          capabilities: JSON.parse(newProvider.capabilities) as ('llm-chat' | 'llm-streaming' | 'image-generation' | 'image-understanding' | 'speech-to-text' | 'text-to-speech')[],
          isActive: newProvider.isActive,
          priority: newProvider.priority,
          config: {},
        });
      } catch (e) {
        console.warn('[Providers API] Failed to register in ProviderRegistry:', e);
      }
    }

    return NextResponse.json({ provider: newProvider }, { status: 201 });
  } catch (error) {
    console.error('[Providers API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to create provider' }, { status: 500 });
  }
}

// PUT - Update a provider (supports rate limit fields, checks rate-limited status on activation)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const existing = await db.aIProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    // When activating a provider, check if it's currently rate-limited
    if (updates.isActive === true && existing.isRateLimited) {
      // Allow activation only if the rate limit reset time has passed
      const now = new Date();
      const resetAt = existing.requestsResetAt;
      if (resetAt && resetAt > now) {
        return NextResponse.json(
          {
            error: 'Cannot activate provider: currently rate-limited',
            details: {
              isRateLimited: existing.isRateLimited,
              lastError: existing.lastError,
              requestsResetAt: existing.requestsResetAt,
            },
          },
          { status: 409 }
        );
      }
      // Reset time has passed, clear rate limit flag
      updates.isRateLimited = false;
      updates.requestsUsed = 0;
      updates.lastError = null;
    }

    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.apiKey !== undefined) data.apiKey = updates.apiKey;
    if (updates.baseUrl !== undefined) data.baseUrl = updates.baseUrl;
    if (updates.models !== undefined) data.models = JSON.stringify(updates.models);
    if (updates.capabilities !== undefined) data.capabilities = JSON.stringify(updates.capabilities);
    if (updates.isActive !== undefined) data.isActive = updates.isActive;
    if (updates.priority !== undefined) data.priority = updates.priority;
    if (updates.config !== undefined) data.config = JSON.stringify(updates.config);

    // Rate limit fields
    if (updates.requestsUsed !== undefined) data.requestsUsed = updates.requestsUsed;
    if (updates.requestsLimit !== undefined) data.requestsLimit = updates.requestsLimit;
    if (updates.requestsResetAt !== undefined) {
      data.requestsResetAt = updates.requestsResetAt ? new Date(updates.requestsResetAt) : null;
    }
    if (updates.tokensUsed !== undefined) data.tokensUsed = updates.tokensUsed;
    if (updates.tokensLimit !== undefined) data.tokensLimit = updates.tokensLimit;
    if (updates.tokensResetAt !== undefined) {
      data.tokensResetAt = updates.tokensResetAt ? new Date(updates.tokensResetAt) : null;
    }
    if (updates.isRateLimited !== undefined) data.isRateLimited = updates.isRateLimited;
    if (updates.lastError !== undefined) data.lastError = updates.lastError;
    if (updates.lastUsedAt !== undefined) {
      data.lastUsedAt = updates.lastUsedAt ? new Date(updates.lastUsedAt) : null;
    }

    const updated = await db.aIProvider.update({
      where: { id },
      data,
    });

    // Re-register in ProviderRegistry
    try {
      const { ProviderRegistry } = await import('@/lib/ai/providers');
      const registry = ProviderRegistry.getInstance();
      if (updated.isActive) {
        registry.registerProvider({
          id: updated.id,
          name: updated.name,
          provider: updated.provider as 'zai' | 'openai' | 'anthropic' | 'google' | 'stability' | 'replicate' | 'openrouter' | 'minimax' | 'custom',
          apiKey: updated.apiKey || undefined,
          baseUrl: updated.baseUrl || undefined,
          models: JSON.parse(updated.models),
          capabilities: JSON.parse(updated.capabilities) as ('llm-chat' | 'llm-streaming' | 'image-generation' | 'image-understanding' | 'speech-to-text' | 'text-to-speech')[],
          isActive: updated.isActive,
          priority: updated.priority,
          config: JSON.parse(updated.config),
        });
      } else {
        registry.removeProvider(updated.id);
      }
    } catch (e) {
      console.warn('[Providers API] Failed to update ProviderRegistry:', e);
    }

    return NextResponse.json({ provider: updated });
  } catch (error) {
    console.error('[Providers API] PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
  }
}

// DELETE - Remove a provider
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await db.aIProvider.delete({ where: { id } });

    try {
      const { ProviderRegistry } = await import('@/lib/ai/providers');
      const registry = ProviderRegistry.getInstance();
      registry.removeProvider(id);
    } catch (e) {
      console.warn('[Providers API] Failed to remove from ProviderRegistry:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Providers API] DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 });
  }
}
