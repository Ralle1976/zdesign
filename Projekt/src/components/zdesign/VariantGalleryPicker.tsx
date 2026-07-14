'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkles, Eye } from 'lucide-react';
import type { DesignVariantResult } from '@/types/design';

export type { DesignVariantResult };

export function VariantGalleryPicker({
  variants,
  previewName,
  onPreview,
  onConfirm,
  showConfirmOnCard = false,
}: {
  variants: DesignVariantResult[];
  previewName: string | null;
  onPreview: (v: DesignVariantResult) => void;
  onConfirm: (v: DesignVariantResult) => void;
  /** Chat compact mode: confirm button only on actively previewed card */
  showConfirmOnCard?: boolean;
}) {
  if (variants.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
        <span>
          Klicke eine Richtung zur <strong className="font-semibold">Vorschau</strong> — erst
          „Übernehmen“ wählt final.
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {variants.map((v) => {
          const isPreview = previewName === v.conceptName;
          return (
            <motion.div
              key={v.conceptName}
              whileHover={{ scale: 1.01 }}
              className={`flex flex-col rounded-xl border bg-card overflow-hidden transition-all text-left ${
                isPreview
                  ? 'border-emerald-500 ring-2 ring-emerald-500/40 shadow-md'
                  : 'border-border hover:border-emerald-300'
              }`}
            >
              <button
                type="button"
                onClick={() => onPreview(v)}
                className="flex flex-col text-left w-full"
              >
                <div className="relative h-32 sm:h-28 bg-zinc-900 overflow-hidden">
                  <iframe
                    title={v.conceptName}
                    srcDoc={v.html}
                    sandbox="allow-scripts"
                    className="w-[200%] h-[200%] origin-top-left scale-50 pointer-events-none border-0"
                  />
                  {isPreview && (
                    <span className="absolute top-1.5 left-1.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                      Vorschau
                    </span>
                  )}
                </div>
                <div className="p-2.5 space-y-1 w-full">
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
                </div>
              </button>
              <div className="px-2.5 pb-2.5">
                <Button
                  type="button"
                  size="sm"
                  variant={isPreview ? 'default' : 'outline'}
                  className={`w-full h-7 text-[10px] gap-1 ${
                    isPreview ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''
                  }`}
                  onClick={() => onPreview(v)}
                >
                  <Eye className="size-3" />
                  Vorschau
                </Button>
                {showConfirmOnCard && isPreview && (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full h-7 text-[10px] gap-1 mt-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => onConfirm(v)}
                  >
                    Diese Richtung übernehmen
                  </Button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}