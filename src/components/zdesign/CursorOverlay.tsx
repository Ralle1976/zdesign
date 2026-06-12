'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { CursorPosition, SelectionInfo } from '@/hooks/useCollaboration';

// ─── Types ───────────────────────────────────────────────────────────

interface CursorOverlayProps {
  cursors: Map<string, CursorPosition>;
  selections: Map<string, SelectionInfo>;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  currentUserId: string;
}

// ─── Cursor Label ────────────────────────────────────────────────────

function CursorLabel({
  cursor,
  containerOffset,
}: {
  cursor: CursorPosition;
  containerOffset: { x: number; y: number };
}) {
  const x = cursor.x - containerOffset.x;
  const y = cursor.y - containerOffset.y;

  return (
    <motion.div
      className="pointer-events-none absolute z-50"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1, x, y }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35, mass: 0.5 }}
      style={{ willChange: 'transform' }}
    >
      {/* Cursor arrow SVG */}
      <svg
        width="16"
        height="20"
        viewBox="0 0 16 20"
        fill="none"
        className="drop-shadow-sm"
      >
        <path
          d="M0 0L16 12L8.5 12L12 20L9 20L5.5 12L0 16V0Z"
          fill={cursor.color || '#f43f5e'}
          stroke="white"
          strokeWidth="1"
        />
      </svg>

      {/* Name tag */}
      <div
        className="ml-3 -mt-1 rounded-md px-2 py-0.5 text-xs font-medium text-white shadow-sm whitespace-nowrap"
        style={{ backgroundColor: cursor.color || '#f43f5e' }}
      >
        {cursor.userId.slice(0, 8)}
      </div>
    </motion.div>
  );
}

// ─── Selection Highlight ─────────────────────────────────────────────

function SelectionHighlight({ selection }: { selection: SelectionInfo }) {
  // This is a visual indicator that another user has selected an element.
  // It works by targeting the element via data-node-id attribute.
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const el = document.querySelector(
      `[data-node-id="${selection.elementId}"]`
    ) as HTMLElement | null;
    if (!el) return;

    const updateRect = () => {
      setRect(el.getBoundingClientRect());
    };

    updateRect();

    const observer = new ResizeObserver(updateRect);
    observer.observe(el);

    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateRect, true);
      window.removeEventListener('resize', updateRect);
    };
  }, [selection.elementId]);

  if (!rect) return null;

  return (
    <motion.div
      className="pointer-events-none fixed z-40 rounded"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        top: rect.top - 2,
        left: rect.left - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        border: `2px solid ${selection.color || '#f43f5e'}`,
        backgroundColor: `${selection.color || '#f43f5e'}15`,
      }}
    >
      {/* Small label showing who selected */}
      <span
        className="absolute -top-5 left-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap"
        style={{ backgroundColor: selection.color || '#f43f5e' }}
      >
        {selection.userId.slice(0, 8)}
      </span>
    </motion.div>
  );
}

// ─── Main Overlay ────────────────────────────────────────────────────

export function CursorOverlay({
  cursors,
  selections,
  containerRef,
  currentUserId,
}: CursorOverlayProps) {
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

  // Track container position for offset calculations
  useEffect(() => {
    if (!containerRef?.current) return;

    const updateOffset = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setContainerOffset({ x: rect.left, y: rect.top });
      }
    };

    updateOffset();

    window.addEventListener('resize', updateOffset);
    window.addEventListener('scroll', updateOffset, true);

    const observer = new ResizeObserver(updateOffset);
    observer.observe(containerRef.current);

    return () => {
      window.removeEventListener('resize', updateOffset);
      window.removeEventListener('scroll', updateOffset, true);
      observer.disconnect();
    };
  }, [containerRef]);

  // Filter out current user's cursor and selections
  const otherCursors = Array.from(cursors.values()).filter(
    (c) => c.userId !== currentUserId
  );
  const otherSelections = Array.from(selections.values()).filter(
    (s) => s.userId !== currentUserId
  );

  // Don't render if no other users are present
  if (otherCursors.length === 0 && otherSelections.length === 0) {
    return null;
  }

  return (
    <>
      {/* Cursor indicators */}
      <AnimatePresence>
        {otherCursors.map((cursor) => (
          <CursorLabel
            key={cursor.userId}
            cursor={cursor}
            containerOffset={containerOffset}
          />
        ))}
      </AnimatePresence>

      {/* Selection highlights */}
      <AnimatePresence>
        {otherSelections.map((selection) => (
          <SelectionHighlight
            key={`${selection.userId}-${selection.elementId}`}
            selection={selection}
          />
        ))}
      </AnimatePresence>
    </>
  );
}

export default CursorOverlay;
