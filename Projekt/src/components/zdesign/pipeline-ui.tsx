'use client';

import { motion } from 'framer-motion';
import type { PipelineStep } from '@/stores/zdesign-store';
import { CheckCircle2, Loader2, Circle, AlertCircle } from 'lucide-react';

export function pipelineStepIcon(status: PipelineStep['status']) {
  if (status === 'done') return <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />;
  if (status === 'active') return <Loader2 className="size-3.5 animate-spin text-amber-500 shrink-0" />;
  if (status === 'error') return <AlertCircle className="size-3.5 text-red-500 shrink-0" />;
  return <Circle className="size-3 text-muted-foreground/40 shrink-0" />;
}

export function formatPipelineElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const r = seconds % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `${r}s`;
}

export function pipelineProgressPct(steps: PipelineStep[]): number {
  const doneCount = steps.filter((s) => s.status === 'done').length;
  return Math.min(98, Math.round((doneCount / Math.max(steps.length, 1)) * 100));
}

export function PipelineStepList({
  steps,
  maxHeight = 'max-h-48',
  size = 'sm',
}: {
  steps: PipelineStep[];
  maxHeight?: string;
  size?: 'sm' | 'md';
}) {
  const textSize = size === 'md' ? 'text-xs' : 'text-[11px]';
  const detailSize = size === 'md' ? 'text-[11px]' : 'text-[10px]';

  return (
    <ul className={`space-y-1 ${maxHeight} overflow-y-auto overscroll-contain pr-1`}>
      {steps.map((s, i) => (
        <motion.li
          key={`${s.step}-${i}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex gap-2 items-start rounded-md px-2 py-1.5 ${textSize} ${
            s.status === 'active'
              ? 'bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40'
              : s.status === 'error'
                ? 'bg-red-50/80 dark:bg-red-950/20'
                : 'bg-background/60'
          }`}
        >
          <span className="mt-0.5">{pipelineStepIcon(s.status)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="font-medium text-foreground leading-snug">{s.label}</span>
              {typeof s.composite === 'number' && (
                <span className={`${detailSize} text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums`}>
                  {s.composite.toFixed(1)}/10
                </span>
              )}
            </div>
            {s.detail && (
              <p className={`${detailSize} text-muted-foreground leading-snug mt-0.5 line-clamp-2`}>
                {s.detail}
              </p>
            )}
          </div>
        </motion.li>
      ))}
    </ul>
  );
}