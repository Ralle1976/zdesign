'use client';

import { useEffect, useState } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, X } from 'lucide-react';
import {
  formatPipelineElapsed,
  pipelineProgressPct,
  PipelineStepList,
} from './pipeline-ui';

export function PipelineStatusPanel({ onCancel }: { onCancel?: () => void }) {
  const { locale } = useI18n();
  const isDe = locale === 'de';
  const steps = useZDesignStore((s) => s.pipelineSteps);
  const variantTracks = useZDesignStore((s) => s.variantTracks);
  const variantLabel = useZDesignStore((s) => s.pipelineVariantLabel);
  const startedAt = useZDesignStore((s) => s.pipelineStartedAt);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const isParallel = variantTracks.length > 0;
  if (!isParallel && steps.length === 0) return null;

  const doneVariants = variantTracks.filter((t) => t.status === 'done').length;
  const pct = isParallel
    ? Math.min(98, Math.round((doneVariants / variantTracks.length) * 100))
    : pipelineProgressPct(steps);

  return (
    <div className="px-4 py-3 border-t bg-muted/20 space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles className="size-3.5 text-emerald-600 shrink-0" />
        <span className="text-xs font-semibold text-foreground">
          {isParallel
            ? isDe
              ? `${doneVariants}/${variantTracks.length} Richtungen`
              : `${doneVariants}/${variantTracks.length} directions`
            : isDe
              ? 'Design-Pipeline läuft'
              : 'Design pipeline running'}
        </span>
        {startedAt && (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            {formatPipelineElapsed(elapsed)}
          </span>
        )}
      </div>

      {variantLabel && (
        <p className="text-[10px] font-medium text-amber-700 dark:text-amber-400">
          {variantLabel}
        </p>
      )}

      <Progress value={pct} className="h-1.5 [&>div]:bg-emerald-500" />

      {isParallel ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {variantTracks.map((track) => (
            <div
              key={track.conceptName}
              className="rounded-lg border bg-background/60 p-2 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold truncate">{track.conceptName}</span>
                {track.status === 'running' && (
                  <Loader2 className="size-2.5 animate-spin text-amber-500 shrink-0" />
                )}
              </div>
              <PipelineStepList steps={track.steps} maxHeight="max-h-28" />
            </div>
          ))}
        </div>
      ) : (
        <PipelineStepList steps={steps} />
      )}

      {onCancel && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 text-muted-foreground"
            onClick={onCancel}
          >
            <X className="size-3" />
            {isDe ? 'Abbrechen' : 'Cancel'}
          </Button>
        </div>
      )}
    </div>
  );
}