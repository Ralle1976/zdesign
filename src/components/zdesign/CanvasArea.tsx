'use client';

import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { DesignRenderer } from '@/components/zdesign/canvas/DesignRenderer';
import { Sparkles, Monitor, Tablet, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import type { ViewportSize } from '@/types/design';

const VIEWPORT_ICONS: Record<ViewportSize, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export function CanvasArea() {
  const { t } = useI18n();
  const canvas = useZDesignStore((s) => s.canvas);
  const isGenerating = useZDesignStore((s) => s.isGenerating);
  const designTree = useZDesignStore((s) => s.designTree);
  const hasDesign = designTree.children && designTree.children.length > 0;
  const ViewportIcon = VIEWPORT_ICONS[canvas.viewport];

  return (
    <div className="flex flex-col h-full bg-muted/30 relative">
      {hasDesign ? (
        /* === DESIGN RENDERED === */
        <div className="flex-1 min-h-0 overflow-hidden">
          <DesignRenderer node={designTree} />
        </div>
      ) : isGenerating ? (
        /* === GENERATING STATE === */
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background rounded-xl shadow-lg border p-12 flex flex-col items-center gap-6"
          >
            <motion.div
              className="flex items-center justify-center size-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25"
              animate={{ scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Sparkles className="size-8" />
            </motion.div>
            <div className="text-center space-y-2">
              <p className="text-base font-semibold">{t.canvas.loading}</p>
              <div className="flex items-center justify-center gap-1.5">
                {[0, 0.2, 0.4].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="size-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        /* === WELCOME / EMPTY STATE === */
        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center space-y-8 max-w-md"
          >
            {/* Logo animation */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mx-auto"
            >
              <div className="flex items-center justify-center size-24 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200/50 dark:border-emerald-800/30 mx-auto shadow-xl shadow-emerald-500/10">
                <div className="flex items-center justify-center size-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
                  <Sparkles className="size-7" />
                </div>
              </div>
            </motion.div>

            {/* Text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="space-y-3"
            >
              <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                {t.canvas.title}
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                {t.canvas.noDesign}
              </p>
            </motion.div>

            {/* Viewport indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50"
            >
              <ViewportIcon className="size-3.5" />
              <span>
                {t.canvas.responsive[canvas.viewport]} &middot; {canvas.zoom}%
              </span>
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
