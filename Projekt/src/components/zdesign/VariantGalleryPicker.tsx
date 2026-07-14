'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Check } from 'lucide-react';
import type { DesignVariantResult } from '@/types/design';

export type { DesignVariantResult };

export function VariantGalleryPicker({
  variants,
  onPick,
}: {
  variants: DesignVariantResult[];
  onPick: (v: DesignVariantResult) => void;
}) {
  if (variants.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 py-3 space-y-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Sparkles className="size-3.5 text-emerald-500" />
        <span>3 Richtungen fertig — wähle die beste Variante:</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {variants.map((v) => (
          <motion.button
            key={v.conceptName}
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => onPick(v)}
            className="group flex flex-col rounded-xl border bg-card overflow-hidden hover:border-emerald-400 hover:ring-2 hover:ring-emerald-400/30 transition-all text-left"
          >
            <div className="relative h-44 sm:h-36 bg-zinc-900 overflow-hidden">
              <iframe
                title={v.conceptName}
                srcDoc={v.html}
                sandbox="allow-scripts"
                className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
              />
            </div>
            <div className="p-2.5 space-y-1">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold line-clamp-1">{v.conceptName}</span>
                {typeof v.composite === 'number' && (
                  <span className="text-[10px] font-bold text-emerald-600 tabular-nums">
                    {v.composite.toFixed(1)}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                {v.bigIdea}
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full h-7 text-[10px] gap-1 mt-1 group-hover:bg-emerald-600 group-hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(v);
                }}
              >
                <Check className="size-3" />
                Diese Richtung
              </Button>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}