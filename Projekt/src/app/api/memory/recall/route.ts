// /api/memory/recall — P1 negative-memory recall (read-only).
//
// GET ?domain=<req>&context=<opt>&limit=<opt>&maxTokens=<opt>
//   → { domain, items: [{source,text,valence,salience,frequency,provenance}], budget, note? }
//
// Surfaces ranked AVOID signals for a domain: anti-patterns from approved
// DesignLessons + negative DesignHistory episodes, scored by a bounded
// loss-aversion salience and token-budgeted. This is the "amygdala/hippocampus"
// read path the agent (and MCP clients) use to NOT repeat past failures —
// proven on the existing Prisma substrate, no Graphiti yet.
//
// Read-only and never throws (degrades to an empty list on any failure).

import { NextRequest, NextResponse } from 'next/server';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const domain = (q.get('domain') ?? '').trim();
  if (!domain) {
    return NextResponse.json(
      { error: 'domain query parameter is required' },
      { status: 400 },
    );
  }
  const context = q.get('context') ?? undefined;
  const limitRaw = q.get('limit');
  const maxTokensRaw = q.get('maxTokens');
  const limit = limitRaw ? Math.max(1, Math.min(100, parseInt(limitRaw, 10) || 25)) : undefined;
  const maxTokens = maxTokensRaw ? Math.max(200, Math.min(8000, parseInt(maxTokensRaw, 10) || 1200)) : undefined;

  try {
    const result = await recallAntiPatterns({ domain, context, limit, maxTokens });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[api/memory/recall] error:', e);
    return NextResponse.json(
      { domain, items: [], budget: { used: 0, max: maxTokens ?? 1200 }, note: 'recall failed (degraded)' },
      { status: 200 },
    );
  }
}
