// POST /api/design/feedback — user thumbs up/down on a design generation.
// GET  /api/design/feedback — recent feedback stats.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { recordFeedback, getFeedbackStats } from '@/lib/ai/improvement/feedback-collector';
import { saveResult, maybeReflect } from '@/lib/ai/memory/lessons';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getFeedbackStats();
    return NextResponse.json({ stats });
  } catch (error) {
    return NextResponse.json(
      { error: 'feedback stats failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      messageId,
      rating,
      domain,
      composite,
      comment,
    } = body as {
      projectId?: string;
      messageId?: string;
      rating: 'up' | 'down';
      domain?: string;
      composite?: number;
      comment?: string;
    };

    if (rating !== 'up' && rating !== 'down') {
      return NextResponse.json({ error: 'rating must be "up" or "down"' }, { status: 400 });
    }

    const skillId = messageId || projectId || `feedback-${Date.now()}`;
    const isPositive = rating === 'up';

    // SECURITY: sanitize user comment before persisting to lessons/memory.
    // Without this, an attacker can inject prompt-instructions via the feedback
    // form that end up in LESSONS.md → injected into every future generate prompt.
    const sanitizeComment = (raw: string | undefined): string => {
      if (!raw) return isPositive ? 'user thumbs up' : 'user thumbs down';
      // Strip anything that looks like an instruction (longer than a label,
      // or containing prompt-injection markers). Keep only short descriptive text.
      const cleaned = raw.slice(0, 120).replace(/[<>{}\\]/g, '').trim();
      if (cleaned.length < 3 || cleaned.length > 120) {
        return isPositive ? 'user thumbs up' : 'user thumbs down';
      }
      return cleaned;
    };
    const safeComment = sanitizeComment(comment);

    await recordFeedback({
      timestamp: Date.now(),
      skillType: 'user-feedback',
      skillId,
      outcome: isPositive ? 'success' : 'failure',
      metrics: {
        composite: typeof composite === 'number' ? composite : undefined,
        userAction: rating,
      },
      context: {
        topic: domain,
        concept: safeComment,
      },
    });

    if (domain) {
      await saveResult({
        domain,
        outcome: isPositive ? 'useful' : 'dead_end',
        composite: typeof composite === 'number' ? composite : isPositive ? 8 : 4,
        detail: safeComment,
      });
      maybeReflect();
    }

    if (messageId) {
      try {
        const msg = await db.chatMessage.findUnique({ where: { id: messageId } });
        if (msg?.metadata) {
          const meta = JSON.parse(msg.metadata) as Record<string, unknown>;
          meta.userFeedback = rating;
          if (comment) meta.userFeedbackComment = comment;
          await db.chatMessage.update({
            where: { id: messageId },
            data: { metadata: JSON.stringify(meta) },
          });
        }
      } catch {
        /* non-fatal */
      }
    }

    return NextResponse.json({ ok: true, rating, recorded: true });
  } catch (error) {
    console.error('[design/feedback]', error);
    return NextResponse.json(
      { error: 'feedback failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}