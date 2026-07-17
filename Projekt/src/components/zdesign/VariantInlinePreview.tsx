'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Eye } from 'lucide-react';
import { HtmlArtifactPreview } from '@/components/zdesign/canvas/HtmlArtifactPreview';
import type { DesignVariantResult } from '@/types/design';

export function VariantInlinePreview({
  variants,
  previewName,
}: {
  variants: DesignVariantResult[];
  previewName: string | null;
}) {
  const previewed = previewName
    ? variants.find((v) => v.conceptName === previewName)
    : null;

  return (
    <AnimatePresence mode="wait">
      {previewed && (
        <motion.div
          key={previewed.conceptName}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mx-3 mb-2 overflow-hidden rounded-xl border border-emerald-500/50 bg-card shadow-md"
        >
          <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-200/60 dark:border-emerald-800/40">
            <Eye className="size-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              Vorschau: <strong>{previewed.conceptName}</strong>
              {typeof previewed.composite === 'number' && (
                <span className="ml-2 tabular-nums text-emerald-600">
                  Score {previewed.composite.toFixed(1)}
                </span>
              )}
            </span>
            <span className="ml-auto text-[10px] text-muted-foreground hidden sm:inline">
              Auch im Canvas (Mitte)
            </span>
          </div>
          <div className="h-[min(52vh,420px)] min-h-[240px]">
            <HtmlArtifactPreview html={previewed.html} viewport="desktop" />
          </div>
          <p className="px-3 py-2 text-[10px] text-muted-foreground border-t line-clamp-2">
            {previewed.bigIdea}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}