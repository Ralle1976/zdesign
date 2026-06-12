'use client';

import React from 'react';
import { motion } from 'framer-motion';
import type { ViewportSize } from '@/types/design';

interface ViewportFrameProps {
  viewport: ViewportSize;
  zoom: number;
  showGrid: boolean;
  panX?: number;
  panY?: number;
  children: React.ReactNode;
}

const VIEWPORT_CONFIG: Record<ViewportSize, { width: string; maxWidth: string; label: string }> = {
  desktop: {
    width: '100%',
    maxWidth: '100%',
    label: 'Desktop',
  },
  tablet: {
    width: '768px',
    maxWidth: '768px',
    label: 'Tablet',
  },
  mobile: {
    width: '375px',
    maxWidth: '375px',
    label: 'Mobile',
  },
};

export const ViewportFrame: React.FC<ViewportFrameProps> = React.memo(
  function ViewportFrame({ viewport, zoom, showGrid, panX = 0, panY = 0, children }) {
    const config = VIEWPORT_CONFIG[viewport];
    const scale = zoom / 100;
    const isDeviceFrame = viewport !== 'desktop';

    return (
      <div className="flex flex-1 items-start justify-center overflow-auto p-4">
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
            transformOrigin: 'top center',
            width: config.width,
            maxWidth: config.maxWidth,
            transition: 'width 0.3s ease, max-width 0.3s ease',
          }}
        >
          {/* Device frame for tablet / mobile */}
          {isDeviceFrame && (
            <div className="mb-2 flex justify-center">
              <div className="flex items-center gap-2 rounded-t-lg bg-gray-800 px-4 py-1.5">
                <div className="h-2 w-2 rounded-full bg-gray-600" />
                <span className="text-xs font-medium text-gray-400">{config.label}</span>
                <div className="h-2 w-2 rounded-full bg-gray-600" />
              </div>
            </div>
          )}

          {/* Canvas area with optional grid */}
          <div
            className="relative overflow-hidden"
            style={{
              backgroundColor: '#fafafa',
              borderRadius: isDeviceFrame ? '0 0 16px 16px' : '8px',
              border: isDeviceFrame ? '2px solid #374151' : '1px solid #e5e7eb',
              boxShadow: isDeviceFrame
                ? '0 25px 50px -12px rgba(0,0,0,0.25)'
                : '0 1px 3px 0 rgba(0,0,0,0.1)',
              minHeight: viewport === 'mobile' ? '667px' : viewport === 'tablet' ? '1024px' : '100%',
            }}
          >
            {/* Grid pattern overlay */}
            {showGrid && (
              <div
                className="pointer-events-none absolute inset-0 z-50"
                style={{
                  backgroundImage:
                    'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                  opacity: 0.4,
                }}
              />
            )}

            {/* Notch for mobile */}
            {viewport === 'mobile' && (
              <div className="absolute left-1/2 top-0 z-50 -translate-x-1/2">
                <div className="h-5 w-32 rounded-b-xl bg-gray-800" />
              </div>
            )}

            {/* Actual design content */}
            <div className="relative z-0">{children}</div>
          </div>

          {/* Home indicator for mobile */}
          {viewport === 'mobile' && (
            <div className="mt-2 flex justify-center">
              <div className="h-1 w-32 rounded-full bg-gray-400" />
            </div>
          )}
        </motion.div>
      </div>
    );
  }
);

ViewportFrame.displayName = 'ViewportFrame';
