'use client';

/**
 * LearningPanel — visible learning loop: recipes, LESSONS, user feedback.
 */

import { useCallback, useEffect, useState } from 'react';

interface RecipeRow {
  id: string;
  topic: string;
  composite: number;
  approved: boolean;
  version: number;
  source: string;
  updatedAt: string;
}

interface LearningData {
  recipes: { approved: RecipeRow[]; pending: RecipeRow[]; total: number };
  lessons: { hasContent: boolean; excerpt: string; lineCount: number };
  feedback: { total: number; successRate: number; avgComposite: number };
}

interface LearningPanelProps {
  projectId?: string;
  messageId?: string;
  domain?: string;
  composite?: number | null;
  className?: string;
}

export function LearningPanel({
  projectId,
  messageId,
  domain,
  composite,
  className = '',
}: LearningPanelProps) {
  const [data, setData] = useState<LearningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedbackSent, setFeedbackSent] = useState<'up' | 'down' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/design/learning');
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendFeedback = async (rating: 'up' | 'down') => {
    if (submitting || feedbackSent) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/design/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          messageId,
          rating,
          domain,
          composite: composite ?? undefined,
        }),
      });
      if (res.ok) {
        setFeedbackSent(rating);
        await load();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`rounded-lg border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur text-xs text-foreground space-y-3 ${className}`}
    >
      <div className="font-semibold text-[11px] uppercase tracking-wide text-muted-foreground">
        Lern-Panel
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">Bewertung:</span>
        <button
          type="button"
          disabled={submitting || feedbackSent !== null}
          onClick={() => sendFeedback('up')}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            feedbackSent === 'up'
              ? 'bg-emerald-600 text-white'
              : 'bg-muted hover:bg-emerald-100'
          }`}
          title="Gutes Design — ins Gedächtnis"
        >
          👍
        </button>
        <button
          type="button"
          disabled={submitting || feedbackSent !== null}
          onClick={() => sendFeedback('down')}
          className={`rounded px-2 py-1 text-sm transition-colors ${
            feedbackSent === 'down'
              ? 'bg-red-600 text-white'
              : 'bg-muted hover:bg-red-100'
          }`}
          title="Schlecht — vermeiden lernen"
        >
          👎
        </button>
        {feedbackSent && (
          <span className="text-[10px] text-muted-foreground">Gespeichert</span>
        )}
      </div>

      {loading && <div className="text-muted-foreground">Lade…</div>}

      {!loading && data && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded bg-muted/50 p-1.5">
              <div className="font-medium">{data.recipes.approved.length}</div>
              <div className="text-[10px] text-muted-foreground">Rezepte</div>
            </div>
            <div className="rounded bg-muted/50 p-1.5">
              <div className="font-medium">
                {data.feedback.avgComposite > 0
                  ? data.feedback.avgComposite.toFixed(1)
                  : '—'}
              </div>
              <div className="text-[10px] text-muted-foreground">Ø Score</div>
            </div>
            <div className="rounded bg-muted/50 p-1.5">
              <div className="font-medium">{data.feedback.total}</div>
              <div className="text-[10px] text-muted-foreground">Feedback</div>
            </div>
          </div>

          {data.recipes.approved.length > 0 && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">
                Bewährte Rezepte
              </div>
              <ul className="space-y-1 max-h-24 overflow-auto">
                {data.recipes.approved.slice(0, 5).map((r) => (
                  <li key={r.id} className="flex justify-between gap-2 border-l-2 border-emerald-400/60 pl-2">
                    <span className="truncate">{r.topic}</span>
                    <span className="shrink-0 text-muted-foreground">Ø{r.composite.toFixed(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.lessons.hasContent && (
            <div>
              <div className="text-[10px] font-medium text-muted-foreground mb-1">
                LESSONS.md ({data.lessons.lineCount} Zeilen)
              </div>
              <pre className="text-[9px] leading-snug text-muted-foreground whitespace-pre-wrap max-h-28 overflow-auto bg-muted/30 rounded p-2">
                {data.lessons.excerpt}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
}