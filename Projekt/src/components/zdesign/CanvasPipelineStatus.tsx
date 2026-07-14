'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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

export function CanvasPipelineStatus() {
  const { locale } = useI18n();
  const isDe = locale === 'de';
  const steps = useZDesignStore((s) => s.pipelineSteps);
  const variantTracks = useZDesignStore((s) => s.variantTracks);
  const variantLabel = useZDesignStore((s) => s.pipelineVariantLabel);
  const startedAt = useZDesignStore((s) => s.pipelineStartedAt);
  const cancelPipeline = useZDesignStore((s) => s.cancelPipeline);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  const isParallel = variantTracks.length > 0;
  const doneVariants = variantTracks.filter((t) => t.status === 'done').length;
  const parallelPct = isParallel
    ? Math.min(98, Math.round((doneVariants / variantTracks.length) * 100))
    : pipelineProgressPct(steps);

  const activeStep = steps.find((s) => s.status === 'active');
  const headline = isParallel
    ? isDe
      ? `${doneVariants}/${variantTracks.length} Richtungen fertig`
      : `${doneVariants}/${variantTracks.length} directions complete`
    : activeStep?.label ?? (isDe ? 'Pipeline läuft...' : 'Pipeline running...');

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-background rounded-2xl shadow-xl border w-full max-w-3xl p-8 flex flex-col gap-5"
      >
        <div className="flex items-start gap-4">
          <motion.div
            className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20 shrink-0"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Loader2 className="size-7 animate-spin" />
          </motion.div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Sparkles className="size-4 text-emerald-600" />
              <h2 className="text-base font-semibold">{headline}</h2>
              {startedAt && (
                <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                  {formatPipelineElapsed(elapsed)}
                </span>
              )}
            </div>
            {variantLabel && (
              <p className="text-sm text-amber-700 dark:text-amber-400 font-medium">{variantLabel}</p>
            )}
            {activeStep?.detail && !isParallel && (
              <p className="text-xs text-muted-foreground line-clamp-2">{activeStep.detail}</p>
            )}
          </div>
        </div>

        <Progress value={parallelPct} className="h-2.5 [&>div]:bg-emerald-500" />

        {isParallel ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {variantTracks.map((track) => (
              <div
                key={track.conceptName}
                className={`rounded-xl border p-3 space-y-2 ${
                  track.status === 'done'
                    ? 'border-emerald-300/60 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : track.status === 'error'
                      ? 'border-red-300/60 bg-red-50/30'
                      : 'border-border bg-muted/20'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">{track.conceptName}</span>
                  {track.status === 'running' && <Loader2 className="size-3 animate-spin text-amber-500" />}
                  {typeof track.composite === 'number' && (
                    <span className="text-[10px] font-bold text-emerald-600 tabular-nums">
                      {track.composite.toFixed(1)}
                    </span>
                  )}
                </div>
                <PipelineStepList steps={track.steps} maxHeight="max-h-40" />
              </div>
            ))}
          </div>
        ) : (
          <PipelineStepList steps={steps} maxHeight="max-h-64" size="md" />
        )}

        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => cancelPipeline()}
          >
            <X className="size-3.5" />
            {isDe ? 'Abbrechen' : 'Cancel'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}