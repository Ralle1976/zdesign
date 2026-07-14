'use client';

import { motion } from 'framer-motion';
import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { VariantGalleryPicker } from './VariantGalleryPicker';
import type { DesignVariantResult } from '@/types/design';

export function CanvasVariantGallery() {
  const { locale } = useI18n();
  const isDe = locale === 'de';
  const variantGallery = useZDesignStore((s) => s.variantGallery);
  const applyVariantPick = useZDesignStore((s) => s.applyVariantPick);
  const addChatMessage = useZDesignStore((s) => s.addChatMessage);
  const projectId = useZDesignStore((s) => s.projectId);

  if (!variantGallery?.length) return null;

  const handlePick = (v: DesignVariantResult) => {
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
    <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-background rounded-2xl shadow-xl border w-full max-w-5xl p-6"
      >
        <h2 className="text-base font-semibold mb-4">
          {isDe ? '3 Richtungen — wähle im Canvas' : '3 directions — pick in canvas'}
        </h2>
        <VariantGalleryPicker variants={variantGallery} onPick={handlePick} />
      </motion.div>
    </div>
  );
}