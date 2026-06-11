'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, Check } from 'lucide-react';
import type { Annotation } from '@/types/design';

interface AnnotationPinProps {
  annotation: Annotation;
  index: number;
  onResolve?: (id: string) => void;
  onClick?: (annotation: Annotation) => void;
}

export const AnnotationPin: React.FC<AnnotationPinProps> = React.memo(
  function AnnotationPin({ annotation, index, onResolve, onClick }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const isOpen = !annotation.isResolved;
    const pinColor = isOpen ? (annotation.color || '#f59e0b') : '#9ca3af';
    const bgColor = isOpen ? '#fef3c7' : '#f3f4f6';
    const textColor = isOpen ? '#92400e' : '#6b7280';

    const handlePinClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded((prev) => !prev);
      onClick?.(annotation);
    };

    const handleResolve = (e: React.MouseEvent) => {
      e.stopPropagation();
      onResolve?.(annotation.id);
      setIsExpanded(false);
    };

    return (
      <div
        className="absolute"
        style={{
          left: annotation.x,
          top: annotation.y,
          zIndex: 100,
        }}
      >
        {/* Pin circle */}
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25, delay: index * 0.05 }}
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={handlePinClick}
          className="flex items-center justify-center rounded-full shadow-lg transition-shadow hover:shadow-xl"
          style={{
            width: 28,
            height: 28,
            backgroundColor: pinColor,
            border: '2px solid #ffffff',
            cursor: 'pointer',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: 700,
          }}
          title={annotation.content}
        >
          {isOpen ? index + 1 : <Check className="h-3 w-3" />}
        </motion.button>

        {/* Expanded comment card */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute left-8 top-0 w-64 overflow-hidden rounded-lg shadow-xl"
              style={{
                backgroundColor: '#ffffff',
                border: `2px solid ${pinColor}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                className="flex items-center gap-2 px-3 py-2"
                style={{ backgroundColor: bgColor }}
              >
                <MessageCircle className="h-3.5 w-3.5" style={{ color: textColor }} />
                <span className="text-xs font-semibold" style={{ color: textColor }}>
                  {annotation.userName}
                </span>
                {annotation.isResolved && (
                  <span className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                    <Check className="h-3 w-3" /> Resolved
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="px-3 py-2">
                <p className="text-xs leading-relaxed text-gray-700">{annotation.content}</p>
              </div>

              {/* Actions */}
              {isOpen && (
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-3 py-2">
                  <button
                    onClick={handleResolve}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    <Check className="h-3 w-3" />
                    Resolve
                  </button>
                </div>
              )}

              {/* Replies count */}
              {annotation.replies && annotation.replies.length > 0 && (
                <div className="border-t border-gray-100 px-3 py-1.5">
                  <span className="text-xs text-gray-400">
                    {annotation.replies.length} {annotation.replies.length === 1 ? 'reply' : 'replies'}
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

AnnotationPin.displayName = 'AnnotationPin';
