'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import type { DesignNodeType, DesignStyle } from '@/types/design';

// ============ Types ============

interface SelectionOverlayProps {
  nodeId: string;
  nodeType: DesignNodeType;
  nodeName?: string;
  nodeStyle?: DesignStyle;
  rect: DOMRect | null;
  containerRect: DOMRect | null;
  onDelete?: (id: string) => void;
  onDeselect?: () => void;
  onMove?: (nodeId: string, deltaX: number, deltaY: number) => void;
  onResize?: (nodeId: string, newStyle: Partial<DesignStyle>) => void;
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

// ============ Constants ============

const TYPE_LABELS: Record<DesignNodeType, string> = {
  root: 'Root',
  container: 'Container',
  flex: 'Flex',
  grid: 'Grid',
  text: 'Text',
  heading: 'Heading',
  button: 'Button',
  input: 'Input',
  image: 'Image',
  icon: 'Icon',
  link: 'Link',
  list: 'List',
  card: 'Card',
  nav: 'Nav',
  header: 'Header',
  footer: 'Footer',
  section: 'Section',
  sidebar: 'Sidebar',
  form: 'Form',
  table: 'Table',
  chart: 'Chart',
  video: 'Video',
  audio: 'Audio',
  slider: 'Slider',
  toggle: 'Toggle',
  tabs: 'Tabs',
  accordion: 'Accordion',
  dialog: 'Dialog',
  dropdown: 'Dropdown',
  badge: 'Badge',
  avatar: 'Avatar',
  divider: 'Divider',
  spacer: 'Spacer',
  custom: 'Custom',
};

const HANDLE_CONFIG: { key: ResizeHandle; cursor: string; style: React.CSSProperties }[] = [
  { key: 'nw', cursor: 'nwse-resize', style: { top: 0, left: 0, transform: 'translate(-50%, -50%)' } },
  { key: 'n', cursor: 'ns-resize', style: { top: 0, left: '50%', transform: 'translate(-50%, -50%)' } },
  { key: 'ne', cursor: 'nesw-resize', style: { top: 0, right: 0, transform: 'translate(50%, -50%)' } },
  { key: 'e', cursor: 'ew-resize', style: { top: '50%', right: 0, transform: 'translate(50%, -50%)' } },
  { key: 'se', cursor: 'nwse-resize', style: { bottom: 0, right: 0, transform: 'translate(50%, 50%)' } },
  { key: 's', cursor: 'ns-resize', style: { bottom: 0, left: '50%', transform: 'translate(-50%, 50%)' } },
  { key: 'sw', cursor: 'nesw-resize', style: { bottom: 0, left: 0, transform: 'translate(-50%, 50%)' } },
  { key: 'w', cursor: 'ew-resize', style: { top: '50%', left: 0, transform: 'translate(-50%, -50%)' } },
];

// ============ Helpers ============

/** Parse a CSS pixel value like "120px" or "0" into a number. Returns fallback for unset/invalid. */
function parsePixelValue(value: string | number | undefined, fallback = 0): number {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number') return value;
  const num = parseFloat(value);
  return isNaN(num) ? fallback : num;
}

// ============ Component ============

export const SelectionOverlay: React.FC<SelectionOverlayProps> = React.memo(
  function SelectionOverlay({
    nodeId,
    nodeType,
    nodeName,
    nodeStyle,
    rect,
    containerRect,
    onDelete,
    onDeselect,
    onMove,
    onResize,
  }) {
    const [isHoveringDelete, setIsHoveringDelete] = useState(false);

    // Drag-to-move state
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef<{ mouseX: number; mouseY: number } | null>(null);
    const [dragDelta, setDragDelta] = useState<{ dx: number; dy: number } | null>(null);

    // Drag-to-resize state
    const [isResizing, setIsResizing] = useState(false);
    const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
    const resizeStartRef = useRef<{
      handle: ResizeHandle;
      mouseX: number;
      mouseY: number;
      origWidth: number;
      origHeight: number;
      origLeft: number;
      origTop: number;
    } | null>(null);
    const [resizePreview, setResizePreview] = useState<{
      width: number; height: number; left: number; top: number;
    } | null>(null);

    // ---- Drag-to-move handlers ----

    const handleDragStart = useCallback(
      (e: React.MouseEvent) => {
        // Only start drag on the selection border area (not on buttons/handles)
        if ((e.target as HTMLElement).dataset?.overlayAction) return;
        e.stopPropagation();
        e.preventDefault();
        dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY };
        setIsDragging(true);
        setDragDelta({ dx: 0, dy: 0 });
      },
      []
    );

    // ---- Drag-to-resize handlers ----

    const handleResizeStart = useCallback(
      (e: React.MouseEvent, handle: ResizeHandle) => {
        e.stopPropagation();
        e.preventDefault();
        const w = rect?.width ?? 0;
        const h = rect?.height ?? 0;
        // Original position from node style
        const origLeft = parsePixelValue(nodeStyle?.left);
        const origTop = parsePixelValue(nodeStyle?.top);
        resizeStartRef.current = {
          handle,
          mouseX: e.clientX,
          mouseY: e.clientY,
          origWidth: w,
          origHeight: h,
          origLeft,
          origTop,
        };
        setIsResizing(true);
        setActiveHandle(handle);
        setResizePreview({ width: w, height: h, left: origLeft, top: origTop });
      },
      [rect, nodeStyle]
    );

    // ---- Global mouse move/up for drag and resize ----

    useEffect(() => {
      if (!isDragging && !isResizing) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (isDragging && dragStartRef.current) {
          const dx = e.clientX - dragStartRef.current.mouseX;
          const dy = e.clientY - dragStartRef.current.mouseY;
          setDragDelta({ dx, dy });
        }

        if (isResizing && resizeStartRef.current) {
          const { handle, mouseX, mouseY, origWidth, origHeight, origLeft, origTop } = resizeStartRef.current;
          const dx = e.clientX - mouseX;
          const dy = e.clientY - mouseY;

          let newWidth = origWidth;
          let newHeight = origHeight;
          let newLeft = origLeft;
          let newTop = origTop;

          // Adjust based on handle direction
          if (handle.includes('e')) {
            newWidth = Math.max(20, origWidth + dx);
          }
          if (handle.includes('w')) {
            newWidth = Math.max(20, origWidth - dx);
            newLeft = origLeft + dx;
          }
          if (handle.includes('s')) {
            newHeight = Math.max(20, origHeight + dy);
          }
          if (handle.includes('n')) {
            newHeight = Math.max(20, origHeight - dy);
            newTop = origTop + dy;
          }

          setResizePreview({ width: newWidth, height: newHeight, left: newLeft, top: newTop });
        }
      };

      const handleMouseUp = () => {
        if (isDragging && dragStartRef.current && dragDelta) {
          // Only fire move if there was actual movement
          if (dragDelta.dx !== 0 || dragDelta.dy !== 0) {
            onMove?.(nodeId, dragDelta.dx, dragDelta.dy);
          }
          dragStartRef.current = null;
          setDragDelta(null);
          setIsDragging(false);
        }

        if (isResizing && resizeStartRef.current && resizePreview) {
          const newStyle: Partial<DesignStyle> = {
            width: `${Math.round(resizePreview.width)}px`,
            height: `${Math.round(resizePreview.height)}px`,
          };

          const { handle } = resizeStartRef.current;
          // If the handle affects position, update left/top too
          if (handle.includes('w') || handle.includes('n')) {
            newStyle.left = `${Math.round(resizePreview.left)}px`;
            newStyle.top = `${Math.round(resizePreview.top)}px`;
          }

          onResize?.(nodeId, newStyle);
          resizeStartRef.current = null;
          setResizePreview(null);
          setIsResizing(false);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isDragging, isResizing, dragDelta, resizePreview, nodeId, onMove, onResize]);

    // ---- Render ----

    if (!rect || !containerRect) return null;

    const label = TYPE_LABELS[nodeType] || nodeType;
    const displayLabel = nodeName ? `${label}: ${nodeName}` : label;

    // Compute position relative to the canvas container
    const relativeLeft = rect.left - containerRect.left;
    const relativeTop = rect.top - containerRect.top;

    // During drag, offset the overlay visually
    const visualLeft = relativeLeft + (dragDelta?.dx ?? 0);
    const visualTop = relativeTop + (dragDelta?.dy ?? 0);
    const visualWidth = resizePreview?.width ?? rect.width;
    const visualHeight = resizePreview?.height ?? rect.height;

    // If resizing with NW/N handles, adjust the visual position
    let resizeOffsetLeft = 0;
    let resizeOffsetTop = 0;
    if (resizePreview && activeHandle) {
      if (activeHandle.includes('w')) {
        resizeOffsetLeft = resizePreview.left - parsePixelValue(nodeStyle?.left);
      }
      if (activeHandle.includes('n')) {
        resizeOffsetTop = resizePreview.top - parsePixelValue(nodeStyle?.top);
      }
    }

    const finalLeft = visualLeft + resizeOffsetLeft;
    const finalTop = visualTop + resizeOffsetTop;

    // Check if the element is positionable (absolute or relative)
    const isPositionable =
      nodeStyle?.position === 'absolute' || nodeStyle?.position === 'relative';

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            top: finalTop,
            left: finalLeft,
            width: visualWidth,
            height: visualHeight,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          data-selection-overlay={nodeId}
        >
          {/* Drag overlay for move - the border area */}
          <div
            className="absolute inset-0 rounded-[2px]"
            style={{
              border: '2px solid #10b981',
              boxShadow: isDragging
                ? '0 0 0 1px rgba(16, 185, 129, 0.4), 0 4px 12px rgba(16, 185, 129, 0.3)'
                : '0 0 0 1px rgba(16, 185, 129, 0.2)',
              pointerEvents: 'auto',
              cursor: isDragging ? 'grabbing' : isPositionable ? 'grab' : 'default',
            }}
            onMouseDown={isPositionable ? handleDragStart : undefined}
          />

          {/* Drag ghost indicator */}
          {isDragging && (
            <div
              className="pointer-events-none absolute inset-0 rounded-[2px]"
              style={{
                border: '2px dashed #10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.05)',
              }}
            />
          )}

          {/* Element info badge - positioned above the selection */}
          <div
            className="absolute"
            style={{
              top: -26,
              left: -2,
              pointerEvents: 'auto',
            }}
          >
            <div
              className="flex items-center gap-1.5 rounded-t-md px-2 py-0.5 text-xs font-medium text-white"
              style={{
                backgroundColor: '#10b981',
                whiteSpace: 'nowrap',
                fontSize: '11px',
                lineHeight: '18px',
              }}
            >
              <span>{displayLabel}</span>
            </div>
          </div>

          {/* Delete button */}
          <div
            className="absolute"
            style={{
              top: -14,
              right: -14,
              pointerEvents: 'auto',
            }}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(nodeId);
              }}
              onMouseEnter={() => setIsHoveringDelete(true)}
              onMouseLeave={() => setIsHoveringDelete(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-colors"
              style={{
                backgroundColor: isHoveringDelete ? '#ef4444' : '#374151',
                border: '2px solid #ffffff',
                cursor: 'pointer',
              }}
              title="Delete element"
              data-overlay-action="delete"
            >
              <Trash2 className="h-3 w-3 text-white" />
            </motion.button>
          </div>

          {/* Close/deselect button */}
          <div
            className="absolute"
            style={{
              top: -14,
              right: 18,
              pointerEvents: 'auto',
            }}
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation();
                onDeselect?.();
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 shadow-md transition-colors hover:bg-gray-500"
              style={{
                border: '2px solid #ffffff',
                cursor: 'pointer',
              }}
              title="Deselect"
              data-overlay-action="deselect"
            >
              <X className="h-3 w-3 text-white" />
            </motion.button>
          </div>

          {/* Resize handles */}
          {HANDLE_CONFIG.map(({ key, cursor, style }) => (
            <div
              key={key}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{
                ...style,
                backgroundColor: '#ffffff',
                border: '2px solid #10b981',
                cursor,
                pointerEvents: 'auto',
                zIndex: 1,
              }}
              onMouseDown={(e) => handleResizeStart(e, key)}
              data-overlay-action="resize"
            />
          ))}

          {/* Dimension label during resize */}
          {isResizing && resizePreview && (
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: -24,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                style={{
                  backgroundColor: '#374151',
                  whiteSpace: 'nowrap',
                  fontSize: '10px',
                  lineHeight: '16px',
                }}
              >
                {Math.round(resizePreview.width)} × {Math.round(resizePreview.height)}
              </div>
            </div>
          )}

          {/* Position label during drag */}
          {isDragging && dragDelta && (
            <div
              className="absolute pointer-events-none"
              style={{
                bottom: -24,
                left: '50%',
                transform: 'translateX(-50%)',
              }}
            >
              <div
                className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
                style={{
                  backgroundColor: '#374151',
                  whiteSpace: 'nowrap',
                  fontSize: '10px',
                  lineHeight: '16px',
                }}
              >
                +{Math.round(dragDelta.dx)}, +{Math.round(dragDelta.dy)}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }
);

SelectionOverlay.displayName = 'SelectionOverlay';
