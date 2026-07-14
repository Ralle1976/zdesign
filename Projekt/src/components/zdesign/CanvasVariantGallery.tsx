'use client';

import { motion } from 'framer-motion';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { HtmlArtifactPreview } from '@/components/zdesign/canvas/HtmlArtifactPreview';
import { VariantGalleryPicker } from './VariantGalleryPicker';
import { Button } from '@/components/ui/button';
import { Check, Eye } from 'lucide-react';
import type { DesignVariantResult } from '@/types/design';

export function CanvasVariantGallery() {
  const { locale } = useI18n();
  const isDe = locale === 'de';
  const canvas = useZDesignStore((s) => s.canvas);
  const variantGallery = useZDesignStore((s) => s.variantGallery);
  const previewName = useZDesignStore((s) => s.variantPreviewName);
  const pickedName = useZDesignStore((s) => s.variantPickedName);
  const setVariantPreviewName = useZDesignStore((s) => s.setVariantPreviewName);
  const applyVariantPick = useZDesignStore((s) => s.applyVariantPick);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const projectId = useZDesignStore((s) => s.projectId);

  if (!variantGallery?.length) return null;

  const previewed =
    variantGallery.find((v) => v.conceptName === previewName) ?? variantGallery[0];

  const handlePreview = (v: DesignVariantResult) => {
    setVariantPreviewName(v.conceptName);
  };

  const handleConfirm = (v: DesignVariantResult) => {
    applyVariantPick(v);
    if (projectId) {
      addChatMessage({
        id: `pick-${Date.now()}`,
        projectId,
        role: 'assistant',
        content: `Richtung „${v.conceptName}" übernommen${v.composite ? ` (Score ${v.composite.toFixed(1)})` : ''}.`,
        metadata: { agent: true, variantPick: v.conceptName },
        createdAt: new Date(),
      });
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-muted/20">
      <div className="shrink-0 px-4 py-3 border-b bg-background/80 backdrop-blur">
        <h2 className="text-sm font-semibold">
          {isDe ? '3 Richtungen — erst ansehen, dann übernehmen' : '3 directions — preview first, then confirm'}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isDe
            ? 'Klicke unten eine Karte für die große Vorschau. „Übernehmen“ wählt endgültig.'
            : 'Click a card below for the large preview. “Confirm” commits your choice.'}
        </p>
      </div>

      <div className="flex-1 min-h-0 relative">
        <motion.div
          key={previewed.conceptName}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex flex-col"
        >
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-amber-50/80 dark:bg-amber-950/30 border-b border-amber-200/60 dark:border-amber-800/40">
            <Eye className="size-3.5 text-amber-600 shrink-0" />
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Vorschau: <strong>{previewed.conceptName}</strong>
              {typeof previewed.composite === 'number' && (
                <span className="ml-2 text-emerald-600 tabular-nums">
                  Score {previewed.composite.toFixed(1)}
                </span>
              )}
            </span>
            <span className="text-[10px] text-muted-foreground ml-auto hidden sm:inline">
              Noch nicht übernommen
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <HtmlArtifactPreview html={previewed.html} viewport={canvas.viewport} />
          </div>
        </motion.div>
      </div>

      <div className="shrink-0 border-t bg-background p-4 space-y-3 max-h-[42%] overflow-y-auto">
        <VariantGalleryPicker
          variants={variantGallery}
          previewName={previewed.conceptName}
          pickedName={pickedName}
          onPreview={handlePreview}
          onConfirm={handleConfirm}
        />
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t">
          <p className="text-[10px] text-muted-foreground mr-auto">
            {previewed.bigIdea}
          </p>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            onClick={() => handleConfirm(previewed)}
          >
            <Check className="size-4" />
            „{previewed.conceptName}" übernehmen
          </Button>
        </div>
      </div>
    </div>
  );
}