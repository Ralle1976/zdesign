// Z.Design — Creative-Direction concepts route (WOW LAYER entrypoint).
//
// POST /api/design/concepts { message, count? }
//   → buildArtBrief(message) → briefLabel(brief) as the short brief summary
//   → generateConcepts(briefLabel, message, callZai, count ?? 3)
//   → { concepts: Concept[] }
//
// Returns 400 on missing message. Never 500s on a model/parse failure —
// generateConcepts returns [] instead, and we ship that empty array so the
// caller can silently fall back to the deterministic brief (no concept).

import { NextRequest, NextResponse } from 'next/server';
import { buildArtBrief, briefLabel } from '@/lib/ai/skills/art-direction';
import { generateConcepts, type Concept } from '@/lib/ai/skills/creative-director';
import { callZai } from '@/lib/ai/zai-direct';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, count } = (body ?? {}) as { message?: string; count?: number };

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 },
      );
    }

    // Deterministic brief gives the director a topic-aware short label
    // (e.g. "asian-spa-thai-wellness — seren · warm") so the concepts stay
    // grounded in the actual domain instead of drifting.
    const brief = buildArtBrief(message);
    const summary = briefLabel(brief);

    const n = typeof count === 'number' && count > 0 ? Math.min(count, 6) : 3;

    const concepts: Concept[] = await generateConcepts(summary, message, callZai, n);

    return NextResponse.json({ concepts });
  } catch (error) {
    console.error('[design/concepts] Error:', error);
    // Never break the caller: ship an empty concept set on hard failure.
    return NextResponse.json({ concepts: [] });
  }
}
