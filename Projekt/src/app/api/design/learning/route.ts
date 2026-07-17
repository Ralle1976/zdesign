// GET /api/design/learning — recipes, LESSONS.md, feedback for LearningPanel.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loadLessons } from '@/lib/ai/memory/lessons';
import { getFeedbackStats } from '@/lib/ai/improvement/feedback-collector';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [recipes, feedbackStats] = await Promise.all([
      db.designLesson.findMany({
        orderBy: [{ approved: 'desc' }, { composite: 'desc' }],
        take: 12,
        select: {
          id: true,
          topic: true,
          composite: true,
          approved: true,
          version: true,
          source: true,
          updatedAt: true,
        },
      }),
      getFeedbackStats(),
    ]);

    const lessonsMarkdown = loadLessons();
    const lessonsExcerpt = lessonsMarkdown
      ? lessonsMarkdown.split('\n').slice(0, 40).join('\n')
      : '';

    const approved = recipes.filter((r) => r.approved);
    const pending = recipes.filter((r) => !r.approved);

    return NextResponse.json({
      recipes: { approved, pending, total: recipes.length },
      lessons: {
        hasContent: lessonsMarkdown.trim().length > 0,
        excerpt: lessonsExcerpt,
        lineCount: lessonsMarkdown.split('\n').length,
      },
      feedback: feedbackStats,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'learning data failed',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}