import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ============ GET - Rate limit status for all active providers ============

export async function GET() {
  try {
    // Use findMany without select to avoid field mismatch issues after schema changes
    const providers = await db.aIProvider.findMany({
      where: { isActive: true },
      orderBy: { priority: 'asc' },
    });

    const result = providers.map((p) => ({
      id: p.id,
      name: p.name,
      provider: p.provider,
      requestsUsed: (p as Record<string, unknown>).requestsUsed as number ?? 0,
      requestsLimit: (p as Record<string, unknown>).requestsLimit as number ?? 0,
      requestsRemaining: ((p as Record<string, unknown>).requestsLimit as number ?? 0) > 0
        ? ((p as Record<string, unknown>).requestsLimit as number ?? 0) - ((p as Record<string, unknown>).requestsUsed as number ?? 0)
        : -1,
      tokensUsed: (p as Record<string, unknown>).tokensUsed as number ?? 0,
      tokensLimit: (p as Record<string, unknown>).tokensLimit as number ?? 0,
      tokensRemaining: ((p as Record<string, unknown>).tokensLimit as number ?? 0) > 0
        ? ((p as Record<string, unknown>).tokensLimit as number ?? 0) - ((p as Record<string, unknown>).tokensUsed as number ?? 0)
        : -1,
      requestsResetAt: (p as Record<string, unknown>).requestsResetAt as string | null ?? null,
      tokensResetAt: (p as Record<string, unknown>).tokensResetAt as string | null ?? null,
      isRateLimited: (p as Record<string, unknown>).isRateLimited as boolean ?? false,
      lastError: (p as Record<string, unknown>).lastError as string | null ?? null,
      lastUsedAt: (p as Record<string, unknown>).lastUsedAt as string | null ?? null,
    }));

    // Always include Z.ai as built-in provider (unlimited)
    result.unshift({
      id: 'zai-default',
      name: 'Z.ai',
      provider: 'zai',
      requestsUsed: 0,
      requestsLimit: 0,
      requestsRemaining: -1,
      tokensUsed: 0,
      tokensLimit: 0,
      tokensRemaining: -1,
      requestsResetAt: null,
      tokensResetAt: null,
      isRateLimited: false,
      lastError: null,
      lastUsedAt: null,
    });

    return NextResponse.json({ providers: result });
  } catch (error) {
    console.error('[Rate Limits API] GET Error:', error);
    return NextResponse.json({ providers: [] });
  }
}

// ============ POST - Update rate limits for a specific provider ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      providerId,
      requestsUsed,
      requestsLimit,
      requestsResetAt,
      tokensUsed,
      tokensLimit,
      tokensResetAt,
      isRateLimited,
      lastError,
    } = body;

    if (!providerId) {
      return NextResponse.json(
        { error: 'providerId is required' },
        { status: 400 }
      );
    }

    const existing = await db.aIProvider.findUnique({
      where: { id: providerId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};

    if (requestsUsed !== undefined) data.requestsUsed = requestsUsed;
    if (requestsLimit !== undefined) data.requestsLimit = requestsLimit;
    if (requestsResetAt !== undefined) {
      data.requestsResetAt = requestsResetAt ? new Date(requestsResetAt) : null;
    }
    if (tokensUsed !== undefined) data.tokensUsed = tokensUsed;
    if (tokensLimit !== undefined) data.tokensLimit = tokensLimit;
    if (tokensResetAt !== undefined) {
      data.tokensResetAt = tokensResetAt ? new Date(tokensResetAt) : null;
    }
    if (isRateLimited !== undefined) data.isRateLimited = isRateLimited;
    if (lastError !== undefined) data.lastError = lastError;

    // Auto-reset rate limit flag if the reset time has passed
    if (isRateLimited === undefined && existing.isRateLimited) {
      const now = new Date();
      const resetAt = existing.requestsResetAt;
      if (resetAt && resetAt <= now) {
        data.isRateLimited = false;
        data.requestsUsed = 0;
        data.lastError = null;
      }
    }

    await db.aIProvider.update({
      where: { id: providerId },
      data,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Rate Limits API] POST Error:', error);
    return NextResponse.json({ error: 'Failed to update rate limits' }, { status: 500 });
  }
}
