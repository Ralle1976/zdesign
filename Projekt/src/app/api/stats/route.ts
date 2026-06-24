// Z.Design - Stats API Route (F0 Observability)
// GET /api/stats — aggregated health/usage snapshot for the StatsBar.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// 24 hours ago, computed fresh per request.
function since24h(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export async function GET() {
  try {
    const since = since24h();

    // Run independent aggregates in parallel for speed.
    const [
      tokenAgg,
      designCount,
      errorCount,
      lessonAgg,
      topModelsRaw,
    ] = await Promise.all([
      // Tokens spent in the last 24h (sum of input + output, excludes cache hits).
      db.tokenLog.aggregate({
        _sum: { inputTokens: true, outputTokens: true },
        where: { createdAt: { gte: since } },
      }),

      // Designs (projects) created in the last 24h.
      db.project.count({
        where: { createdAt: { gte: since } },
      }),

      // Errors (level = error) in the last 24h.
      db.errorLog.count({
        where: { level: 'error', createdAt: { gte: since } },
      }),

      // Average composite score from approved/auto lessons (last 50 as a
      // rolling proxy for "design quality right now").
      db.designLesson.aggregate({
        _avg: { composite: true },
        where: { createdAt: { gte: since } },
      }),

      // Top model by call count in the last 24h (group + sort in JS — SQLite).
      db.tokenLog.groupBy({
        by: ['model'],
        _count: { model: true },
        where: { createdAt: { gte: since } },
        orderBy: { model: 'asc' },
      }),
    ]);

    const tokensToday =
      (tokenAgg._sum.inputTokens ?? 0) + (tokenAgg._sum.outputTokens ?? 0);

    // topModel = the model with the most calls in the window.
    let topModel: string | null = null;
    let topCount = 0;
    for (const row of topModelsRaw) {
      const c = row._count.model;
      if (c > topCount) {
        topCount = c;
        topModel = row.model;
      }
    }

    const avgComposite =
      lessonAgg._avg.composite != null
        ? Number(lessonAgg._avg.composite.toFixed(2))
        : null;

    // rateLimitStatus: best-effort. Z.ai has no public rate-limit header we can
    // read retroactively, so we report the recent error velocity as a proxy.
    // 'ok' if few errors, 'degraded' if a burst, 'unknown' if we can't tell.
    let rateLimitStatus: 'ok' | 'degraded' | 'unknown' = 'ok';
    try {
      const recentErrs = await db.errorLog.count({
        where: {
          level: 'error',
          component: 'callZai',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) }, // last hour
        },
      });
      if (recentErrs >= 5) rateLimitStatus = 'degraded';
    } catch {
      rateLimitStatus = 'unknown';
    }

    return NextResponse.json({
      tokensToday,
      designsToday: designCount,
      errorCount24h: errorCount,
      avgComposite,
      topModel,
      rateLimitStatus,
      window: '24h',
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    // Never 500-crash the status bar — return a safe skeleton.
    return NextResponse.json({
      tokensToday: 0,
      designsToday: 0,
      errorCount24h: 0,
      avgComposite: null,
      topModel: null,
      rateLimitStatus: 'unknown',
      window: '24h',
      error: 'stats aggregation failed',
      detail: error instanceof Error ? error.message : String(error),
    });
  }
}
