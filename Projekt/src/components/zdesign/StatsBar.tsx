'use client';

/**
 * StatsBar.tsx — compact observability footer (F0).
 *
 * Renders a tiny one-line status strip:
 *   "Heute: X Designs · YK Tokens · Z Errors · Øscore · model · status"
 *
 * Polls /api/stats every 30s. Non-intrusive: small, muted, sits at the very
 * bottom. Errors while polling are swallowed (the bar just keeps the last good
 * snapshot, or shows dashes if it never got one).
 */

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface StatsSnapshot {
  tokensToday: number;
  designsToday: number;
  errorCount24h: number;
  avgComposite: number | null;
  topModel: string | null;
  rateLimitStatus: 'ok' | 'degraded' | 'unknown';
}

const POLL_MS = 30_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function StatsBar() {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const res = await fetch('/api/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data) {
          setStats({
            tokensToday: data.tokensToday ?? 0,
            designsToday: data.designsToday ?? 0,
            errorCount24h: data.errorCount24h ?? 0,
            avgComposite:
              typeof data.avgComposite === 'number' ? data.avgComposite : null,
            topModel: data.topModel ?? null,
            rateLimitStatus: data.rateLimitStatus ?? 'unknown',
          });
          setLoaded(true);
        }
      } catch {
        // Network error — keep last good snapshot, never crash the UI.
      }
    }

    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const s = stats;
  const dot =
    !loaded || !s
      ? 'bg-muted-foreground/40'
      : s.rateLimitStatus === 'ok'
        ? 'bg-emerald-500'
        : s.rateLimitStatus === 'degraded'
          ? 'bg-amber-500'
          : 'bg-muted-foreground';

  const StatusIcon =
    !loaded || !s
      ? Activity
      : s.rateLimitStatus === 'ok'
        ? CheckCircle2
        : s.rateLimitStatus === 'degraded'
          ? AlertTriangle
          : Activity;

  return (
    <div className="flex items-center gap-2 px-2 h-5 text-[10px] text-muted-foreground/80 border-t bg-background/60 select-none shrink-0">
      <span className="font-medium tracking-wide opacity-70">Heute:</span>

      <span>
        {loaded && s ? s.designsToday : '–'} Designs
      </span>
      <Sep />
      <span>
        {loaded && s ? formatTokens(s.tokensToday) : '–'} Tokens
      </span>
      <Sep />
      <span className={loaded && s && s.errorCount24h > 0 ? 'text-amber-600' : ''}>
        {loaded && s ? s.errorCount24h : '–'} Errors
      </span>
      <Sep />
      <span>
        Ø{' '}
        {loaded && s && s.avgComposite != null
          ? s.avgComposite.toFixed(1)
          : '–'}
      </span>

      {loaded && s && s.topModel && (
        <>
          <Sep />
          <span className="font-mono opacity-60">{s.topModel}</span>
        </>
      )}

      <span className="ml-auto flex items-center gap-1">
        <StatusIcon className="size-3" />
        <span className={`inline-block size-1.5 rounded-full ${dot}`} />
      </span>
    </div>
  );
}

function Sep() {
  return <span className="opacity-30">·</span>;
}
