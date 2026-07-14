'use client';

import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { LayoutGrid, X } from 'lucide-react';

export function VariantGalleryRestoreButton({
  className = '',
  showDismiss = false,
}: {
  className?: string;
  showDismiss?: boolean;
}) {
  const { locale } = useI18n();
  const isDe = locale === 'de';
  const archive = useZDesignStore((s) => s.variantGalleryArchive);
  const gallery = useZDesignStore((s) => s.variantGallery);
  const pickedName = useZDesignStore((s) => s.variantPickedName);
  const restoreVariantGallery = useZDesignStore((s) => s.restoreVariantGallery);
  const clearVariantGalleryArchive = useZDesignStore((s) => s.clearVariantGalleryArchive);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const projectId = useZDesignStore((s) => s.projectId);

  if (!archive?.length || gallery?.length) return null;

  const handleRestore = () => {
    restoreVariantGallery();
    if (projectId) {
      addChatMessage({
        id: `gallery-restore-${Date.now()}`,
        projectId,
        role: 'system',
        content: isDe
          ? `3er-Vergleich wieder geöffnet${pickedName ? ` (zuletzt: „${pickedName}")` : ''} — Vorschau durchklicken, dann erneut übernehmen.`
          : `Reopened 3-way compare — preview each, then confirm again.`,
        createdAt: new Date(),
      });
    }
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs gap-1.5 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
        onClick={handleRestore}
      >
        <LayoutGrid className="size-3.5" />
        {isDe ? `Zurück zum 3er-Vergleich (${archive.length})` : `Back to compare (${archive.length})`}
      </Button>
      {showDismiss && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground"
          title={isDe ? 'Vergleich archiv verwerfen' : 'Dismiss compare archive'}
          onClick={() => clearVariantGalleryArchive()}
        >
          <X className="size-3.5" />
        </Button>
      )}
    </div>
  );
}