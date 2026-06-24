'use client';

import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Monitor,
  Tablet,
  Smartphone,
  Grid3x3,
  MessageCircle,
  Maximize,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import type { ViewportSize } from '@/types/design';

interface CanvasToolbarProps {
  zoom: number;
  viewport: ViewportSize;
  showGrid: boolean;
  showAnnotations: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  onViewportChange: (viewport: ViewportSize) => void;
  onToggleGrid: () => void;
  onToggleAnnotations: () => void;
  onFullscreen?: () => void;
}

const ZOOM_STEP = 10;
const ZOOM_MIN = 25;
const ZOOM_MAX = 200;

export const CanvasToolbar: React.FC<CanvasToolbarProps> = React.memo(
  function CanvasToolbar({
    zoom,
    viewport,
    showGrid,
    showAnnotations,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onViewportChange,
    onToggleGrid,
    onToggleAnnotations,
    onFullscreen,
  }) {
    const canZoomIn = zoom < ZOOM_MAX;
    const canZoomOut = zoom > ZOOM_MIN;

    const viewportButtons: { key: ViewportSize; icon: React.ReactNode; label: string }[] = [
      { key: 'desktop', icon: <Monitor className="h-4 w-4" />, label: 'Desktop' },
      { key: 'tablet', icon: <Tablet className="h-4 w-4" />, label: 'Tablet (768px)' },
      { key: 'mobile', icon: <Smartphone className="h-4 w-4" />, label: 'Mobile (375px)' },
    ];

    return (
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
        <div
          className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white/90 px-2 py-1.5 shadow-lg backdrop-blur-sm"
          style={{ borderColor: '#e5e7eb' }}
        >
          {/* Zoom controls */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onZoomOut}
                  disabled={!canZoomOut}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Zoom Out</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={onZoomReset}
                  className="flex h-8 min-w-[48px] items-center justify-center rounded-md px-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100"
                  style={{ cursor: 'pointer', border: 'none', background: 'transparent' }}
                >
                  {zoom}%
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">Reset Zoom</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onZoomIn}
                  disabled={!canZoomIn}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Zoom In</TooltipContent>
            </Tooltip>
          </div>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-gray-200" />

          {/* Viewport toggle */}
          <div className="flex items-center gap-0.5">
            {viewportButtons.map(({ key, icon, label }) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewport === key ? 'default' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onViewportChange(key)}
                    style={
                      viewport === key
                        ? { backgroundColor: '#10b981' }
                        : undefined
                    }
                  >
                    {icon}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-gray-200" />

          {/* Grid toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleGrid}
                style={
                  showGrid
                    ? { backgroundColor: '#10b981' }
                    : undefined
                }
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Toggle Grid</TooltipContent>
          </Tooltip>

          {/* Annotations toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showAnnotations ? 'default' : 'ghost'}
                size="icon"
                className="h-8 w-8"
                onClick={onToggleAnnotations}
                style={
                  showAnnotations
                    ? { backgroundColor: '#10b981' }
                    : undefined
                }
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Toggle Annotations</TooltipContent>
          </Tooltip>

          {/* Divider */}
          <div className="mx-1 h-6 w-px bg-gray-200" />

          {/* Fullscreen */}
          {onFullscreen && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={onFullscreen}
                >
                  <Maximize className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Fullscreen</TooltipContent>
            </Tooltip>
          )}

          {/* Reset view */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onZoomReset}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Reset View</TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }
);

CanvasToolbar.displayName = 'CanvasToolbar';

export { ZOOM_STEP, ZOOM_MIN, ZOOM_MAX };
