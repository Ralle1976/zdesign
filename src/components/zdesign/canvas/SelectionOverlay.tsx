'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2 } from 'lucide-react';
import type { DesignNodeType } from '@/types/design';

interface SelectionOverlayProps {
  nodeId: string;
  nodeType: DesignNodeType;
  nodeName?: string;
  rect: DOMRect | null;
  onDelete?: (id: string) => void;
  onDeselect?: () => void;
}

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

const HANDLE_POSITIONS = [
  { position: 'top-0 left-0', cursor: 'nwse-resize', transform: 'translate(-50%, -50%)' },
  { position: 'top-0 right-0', cursor: 'nesw-resize', transform: 'translate(50%, -50%)' },
  { position: 'bottom-0 left-0', cursor: 'nesw-resize', transform: 'translate(-50%, 50%)' },
  { position: 'bottom-0 right-0', cursor: 'nwse-resize', transform: 'translate(50%, 50%)' },
  { position: 'top-0 left-1/2', cursor: 'ns-resize', transform: 'translate(-50%, -50%)' },
  { position: 'bottom-0 left-1/2', cursor: 'ns-resize', transform: 'translate(-50%, 50%)' },
  { position: 'top-1/2 left-0', cursor: 'ew-resize', transform: 'translate(-50%, -50%)' },
  { position: 'top-1/2 right-0', cursor: 'ew-resize', transform: 'translate(50%, -50%)' },
] as const;

export const SelectionOverlay: React.FC<SelectionOverlayProps> = React.memo(
  function SelectionOverlay({ nodeId, nodeType, nodeName, rect, onDelete, onDeselect }) {
    const [isHoveringDelete, setIsHoveringDelete] = useState(false);

    const handleDelete = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.(nodeId);
      },
      [onDelete, nodeId]
    );

    const handleDeselect = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onDeselect?.();
      },
      [onDeselect]
    );

    if (!rect) return null;

    const label = TYPE_LABELS[nodeType] || nodeType;
    const displayLabel = nodeName ? `${label}: ${nodeName}` : label;

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
          data-selection-overlay={nodeId}
        >
          {/* Selection border */}
          <div
            className="absolute inset-0 rounded-[2px]"
            style={{
              border: '2px solid #10b981',
              boxShadow: '0 0 0 1px rgba(16, 185, 129, 0.2)',
              pointerEvents: 'none',
            }}
          />

          {/* Element info badge - positioned above the selection */}
          {rect.top > 28 && (
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
          )}

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
              onClick={handleDelete}
              onMouseEnter={() => setIsHoveringDelete(true)}
              onMouseLeave={() => setIsHoveringDelete(false)}
              className="flex h-6 w-6 items-center justify-center rounded-full shadow-md transition-colors"
              style={{
                backgroundColor: isHoveringDelete ? '#ef4444' : '#374151',
                border: '2px solid #ffffff',
                cursor: 'pointer',
              }}
              title="Delete element"
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
              onClick={handleDeselect}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-400 shadow-md transition-colors hover:bg-gray-500"
              style={{
                border: '2px solid #ffffff',
                cursor: 'pointer',
              }}
              title="Deselect"
            >
              <X className="h-3 w-3 text-white" />
            </motion.button>
          </div>

          {/* Resize handles - visual only for now */}
          {HANDLE_POSITIONS.map((handle, i) => (
            <div
              key={i}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{
                ...(handle.position.includes('top-0') && handle.position.includes('left-0') && { top: 0, left: 0 }),
                ...(handle.position.includes('top-0') && handle.position.includes('right-0') && { top: 0, right: 0 }),
                ...(handle.position.includes('bottom-0') && handle.position.includes('left-0') && { bottom: 0, left: 0 }),
                ...(handle.position.includes('bottom-0') && handle.position.includes('right-0') && { bottom: 0, right: 0 }),
                ...(handle.position.includes('left-1/2') && !handle.position.includes('left-0') && { top: '50%', left: 0 }),
                ...(handle.position.includes('top-1/2') && !handle.position.includes('top-0') && { top: 0, left: '50%' }),
                transform: handle.transform,
                backgroundColor: '#ffffff',
                border: '2px solid #10b981',
                cursor: handle.cursor,
                pointerEvents: 'auto',
              }}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    );
  }
);

SelectionOverlay.displayName = 'SelectionOverlay';
