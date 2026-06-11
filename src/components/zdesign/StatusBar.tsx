'use client';

import { useZDesignStore } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  MousePointer2,
  Monitor,
  Tablet,
  Smartphone,
  ZoomIn,
  Globe,
  Clock,
} from 'lucide-react';
import type { CanvasMode, ViewportSize } from '@/types/design';

const MODE_ICONS: Record<CanvasMode, typeof Sparkles> = {
  ai: Sparkles,
  editor: MousePointer2,
};

const VIEWPORT_ICONS: Record<ViewportSize, typeof Monitor> = {
  desktop: Monitor,
  tablet: Tablet,
  mobile: Smartphone,
};

export function StatusBar() {
  const { t, locale } = useI18n();
  const canvas = useZDesignStore((s) => s.canvas);

  const ModeIcon = MODE_ICONS[canvas.mode];
  const ViewportIcon = VIEWPORT_ICONS[canvas.viewport];

  return (
    <footer className="flex items-center h-6 px-3 text-[11px] text-muted-foreground border-t bg-background/80 backdrop-blur shrink-0 select-none">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mode */}
        <div className="flex items-center gap-1.5">
          <ModeIcon
            className={`size-3 ${canvas.mode === 'ai' ? 'text-emerald-600' : 'text-muted-foreground'}`}
          />
          <span>
            {canvas.mode === 'ai' ? t.canvas.aiMode : t.canvas.editorMode}
          </span>
        </div>

        <Separator orientation="vertical" className="h-3" />

        {/* Viewport */}
        <div className="flex items-center gap-1.5">
          <ViewportIcon className="size-3" />
          <span>{t.canvas.responsive[canvas.viewport]}</span>
        </div>

        <Separator orientation="vertical" className="h-3" />

        {/* Zoom */}
        <div className="flex items-center gap-1.5">
          <ZoomIn className="size-3" />
          <span>{canvas.zoom}%</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language */}
        <div className="flex items-center gap-1.5">
          <Globe className="size-3" />
          <span className="uppercase">{locale}</span>
        </div>

        <Separator orientation="vertical" className="h-3" />

        {/* Version */}
        <div className="flex items-center gap-1.5">
          <Clock className="size-3" />
          <span>v0.1.0</span>
        </div>
      </div>
    </footer>
  );
}
