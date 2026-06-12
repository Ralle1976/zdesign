'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useZDesignStore } from '@/stores/zdesign-store';
import type { DesignNode, ViewportSize, Annotation } from '@/types/design';
import { mapDesignStyleToCSS, mergeStyles } from './styleMapper';
import { getDefaultStyle, getHeadingLevel, getHtmlTag, isSelfClosingTag } from './nodeTypeMap';
import { SelectionOverlay } from './SelectionOverlay';
import { AnnotationPin } from './AnnotationPin';
import { ViewportFrame } from './ViewportFrame';
import { CanvasToolbar, ZOOM_MIN, ZOOM_MAX, ZOOM_STEP } from './CanvasToolbar';

// ============ DesignRenderer Props ============

interface DesignRendererProps {
  node: DesignNode;
  selectedId?: string | null;
  hoveredId?: string | null;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  onAnnotationClick?: (x: number, y: number) => void;
  showAnnotations?: boolean;
  viewport?: 'desktop' | 'tablet' | 'mobile';
}

// ============ Single Node Renderer ============

interface NodeRendererProps {
  node: DesignNode;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  depth: number;
}

const NodeRenderer: React.FC<NodeRendererProps> = React.memo(
  function NodeRenderer({ node, selectedId, hoveredId, onSelect, onHover, depth }) {
    const isSelected = selectedId === node.id;
    const isHovered = hoveredId === node.id;
    const tag = getHtmlTag(node);

    // For heading nodes, determine the correct level
    const actualTag = node.type === 'heading' ? getHeadingLevel(node) : tag;

    // Build accessibility attributes from meta
    const a11yAttrs: Record<string, string> = {};
    if (node.meta?.role || node.meta?.a11yRole) {
      a11yAttrs.role = node.meta.role || node.meta?.a11yRole || '';
    }
    if (node.meta?.ariaLabel || node.meta?.a11yLabel) {
      a11yAttrs['aria-label'] = node.meta.ariaLabel || node.meta?.a11yLabel || '';
    }
    // For images, add alt text
    if (node.type === 'image') {
      a11yAttrs.alt = node.meta?.alt || node.meta?.description || node.meta?.a11yLabel || '';
    }

    // Merge default styles with node-specific styles
    const defaultStyle = useMemo(() => getDefaultStyle(node.type), [node.type]);
    const mergedStyle = useMemo(
      () => mergeStyles(defaultStyle, node.style),
      [defaultStyle, node.style]
    );
    const cssStyle = useMemo(() => mapDesignStyleToCSS(mergedStyle), [mergedStyle]);

    // Add selection/hover visual indicators via outline (not border to avoid layout shift)
    const interactiveStyle: React.CSSProperties = {
      ...cssStyle,
      outline: isSelected
        ? '2px solid #10b981'
        : isHovered
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : cssStyle.outline,
      outlineOffset: isSelected ? '2px' : isHovered ? '1px' : undefined,
      cursor: node.type === 'button' || node.type === 'link' ? 'pointer' : undefined,
      transition: 'outline 0.15s ease, background-color 0.15s ease',
      backgroundColor: isHovered && !isSelected
        ? (cssStyle.backgroundColor || 'rgba(16, 185, 129, 0.05)')
        : cssStyle.backgroundColor,
    };

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(node.id);
      },
      [onSelect, node.id]
    );

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onHover(node.id);
      },
      [onHover, node.id]
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onHover(null);
      },
      [onHover]
    );

    // Self-closing tags (input, hr, img, etc.) don't render children
    if (isSelfClosingTag(actualTag)) {
      return React.createElement(actualTag, {
        'data-node-id': node.id,
        'data-node-type': node.type,
        style: interactiveStyle,
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ...a11yAttrs,
        ...(node.type === 'input' ? { placeholder: node.content || 'Input...', type: 'text' } : {}),
        ...(node.type === 'slider' ? { type: 'range' } : {}),
        ...(node.props ?? {}),
      });
    }

    // Image type renders as div with background-image
    if (node.type === 'image') {
      const imageStyle: React.CSSProperties = {
        ...interactiveStyle,
        backgroundImage: node.content
          ? `url(${node.content})`
          : 'linear-gradient(135deg, #e5e7eb 0%, #d1d5db 100%)',
      };
      return React.createElement(
        actualTag,
        {
          'data-node-id': node.id,
          'data-node-type': node.type,
          style: imageStyle,
          onClick: handleClick,
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
          ...a11yAttrs,
        },
        !node.content && (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.41a2.25 2.25 0 013.182 0l2.909 2.91m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
              />
            </svg>
          </div>
        ),
        node.children?.map((child) => (
          <NodeRenderer
            key={child.id}
            node={child}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={onSelect}
            onHover={onHover}
            depth={depth + 1}
          />
        ))
      );
    }

    // Divider type
    if (node.type === 'divider') {
      return React.createElement('hr', {
        'data-node-id': node.id,
        'data-node-type': node.type,
        style: interactiveStyle,
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
      });
    }

    // Badge, avatar, icon - inline elements
    if (node.type === 'badge' || node.type === 'avatar' || node.type === 'icon') {
      return React.createElement(
        actualTag,
        {
          'data-node-id': node.id,
          'data-node-type': node.type,
          style: interactiveStyle,
          onClick: handleClick,
          onMouseEnter: handleMouseEnter,
          onMouseLeave: handleMouseLeave,
          ...a11yAttrs,
        },
        node.content,
        node.children?.map((child) => (
          <NodeRenderer
            key={child.id}
            node={child}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={onSelect}
            onHover={onHover}
            depth={depth + 1}
          />
        ))
      );
    }

    // Default: render element with content and/or children
    return React.createElement(
      actualTag,
      {
        'data-node-id': node.id,
        'data-node-type': node.type,
        style: interactiveStyle,
        onClick: handleClick,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        ...a11yAttrs,
        ...(node.type === 'link' ? { href: '#' } : {}),
        ...(node.type === 'button' ? { type: 'button' } : {}),
        ...(node.props ?? {}),
      },
      // Text content
      node.content || null,
      // Children
      ...(node.children?.map((child) => (
        <NodeRenderer
          key={child.id}
          node={child}
          selectedId={selectedId}
          hoveredId={hoveredId}
          onSelect={onSelect}
          onHover={onHover}
          depth={depth + 1}
        />
      )) ?? [])
    );
  }
);

NodeRenderer.displayName = 'NodeRenderer';

// ============ Main DesignRenderer Component ============

export const DesignRenderer: React.FC<DesignRendererProps> = React.memo(
  function DesignRenderer({
    node,
    selectedId: externalSelectedId,
    hoveredId: externalHoveredId,
    onSelect: externalOnSelect,
    onHover: externalOnHover,
    onAnnotationClick,
    showAnnotations: externalShowAnnotations,
    viewport: externalViewport,
  }) {
    // Connect to store for default behavior
    const store = useZDesignStore();
    const selectedId = externalSelectedId ?? store.canvas.selectedNodeId;
    const hoveredId = externalHoveredId ?? store.canvas.hoveredNodeId;
    const showAnnotations = externalShowAnnotations ?? store.canvas.showAnnotations;
    const viewport = externalViewport ?? store.canvas.viewport;
    const zoom = store.canvas.zoom;
    const showGrid = store.canvas.showGrid;
    const annotations = store.annotations;

    const canvasRef = useRef<HTMLDivElement>(null);
    const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
    const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

    // Panning state
    const [isPanning, setIsPanning] = useState(false);
    const [spaceHeld, setSpaceHeld] = useState(false);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);

    // ---- Update selection rect ----

    const updateSelectionRect = useCallback(() => {
      if (selectedId && canvasRef.current) {
        const el = canvasRef.current.querySelector(`[data-node-id="${selectedId}"]`);
        if (el) {
          setSelectionRect(el.getBoundingClientRect());
        } else {
          setSelectionRect(null);
        }
      } else {
        setSelectionRect(null);
      }
    }, [selectedId]);

    // Update container rect
    const updateContainerRect = useCallback(() => {
      if (canvasRef.current) {
        setContainerRect(canvasRef.current.getBoundingClientRect());
      }
    }, []);

    // Update selection overlay rect when selection changes
    useEffect(() => {
      updateSelectionRect();
      updateContainerRect();
    }, [selectedId, node, updateSelectionRect, updateContainerRect]);

    // Update rect on scroll / resize
    useEffect(() => {
      if (!selectedId) return;

      const updateRects = () => {
        updateSelectionRect();
        updateContainerRect();
      };

      window.addEventListener('scroll', updateRects, true);
      window.addEventListener('resize', updateRects);
      const observer = new ResizeObserver(updateRects);
      if (canvasRef.current) observer.observe(canvasRef.current);

      return () => {
        window.removeEventListener('scroll', updateRects, true);
        window.removeEventListener('resize', updateRects);
        observer.disconnect();
      };
    }, [selectedId, updateSelectionRect, updateContainerRect]);

    // ---- Keyboard shortcuts ----

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Track space key for panning
        if (e.code === 'Space' && !e.repeat) {
          setSpaceHeld(true);
          return;
        }

        // Skip if user is typing in an input/textarea/contentEditable
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        // Delete/Backspace: delete selected node
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
          e.preventDefault();
          store.deleteNode(selectedId);
          store.selectNode(null);
          return;
        }

        // Escape: deselect
        if (e.key === 'Escape' && selectedId) {
          e.preventDefault();
          store.selectNode(null);
          return;
        }

        // Ctrl+Z / Cmd+Z: undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          store.undo();
          return;
        }

        // Ctrl+Shift+Z / Ctrl+Y / Cmd+Shift+Z: redo
        if (
          ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
          ((e.ctrlKey || e.metaKey) && e.key === 'y')
        ) {
          e.preventDefault();
          store.redo();
          return;
        }

        // Arrow keys: nudge selected element
        if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const nudge = e.shiftKey ? 10 : 1;
          switch (e.key) {
            case 'ArrowUp':
              store.nudgeNode(selectedId, 0, -nudge);
              break;
            case 'ArrowDown':
              store.nudgeNode(selectedId, 0, nudge);
              break;
            case 'ArrowLeft':
              store.nudgeNode(selectedId, -nudge, 0);
              break;
            case 'ArrowRight':
              store.nudgeNode(selectedId, nudge, 0);
              break;
          }
          return;
        }
      };

      const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code === 'Space') {
          setSpaceHeld(false);
          // If we were panning, stop
          if (isPanning) {
            setIsPanning(false);
            panStartRef.current = null;
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);

      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
      };
    }, [selectedId, store, isPanning, spaceHeld]);

    // ---- Canvas panning (Space + drag) ----

    useEffect(() => {
      if (!isPanning) return;

      const handleMouseMove = (e: MouseEvent) => {
        if (!panStartRef.current) return;
        const dx = e.clientX - panStartRef.current.mouseX;
        const dy = e.clientY - panStartRef.current.mouseY;
        setPanOffset({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy,
        });
      };

      const handleMouseUp = () => {
        setIsPanning(false);
        panStartRef.current = null;
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }, [isPanning]);

    const handleCanvasMouseDown = useCallback(
      (e: React.MouseEvent) => {
        // Space + click = pan
        if (spaceHeld) {
          e.preventDefault();
          e.stopPropagation();
          setIsPanning(true);
          panStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            panX: panOffset.x,
            panY: panOffset.y,
          };
          return;
        }

        // Clicking canvas background deselects
        if ((e.target as HTMLElement).dataset?.nodeId === undefined) {
          store.selectNode(null);
        }
      },
      [store, panOffset, spaceHeld]
    );

    // ---- Handlers ----

    const handleSelect = useCallback(
      (id: string) => {
        store.selectNode(id);
        externalOnSelect?.(id);
      },
      [store, externalOnSelect]
    );

    const handleHover = useCallback(
      (id: string | null) => {
        store.hoverNode(id);
        externalOnHover?.(id);
      },
      [store, externalOnHover]
    );

    const handleDelete = useCallback(
      (id: string) => {
        store.deleteNode(id);
        store.selectNode(null);
      },
      [store]
    );

    const handleDeselect = useCallback(() => {
      store.selectNode(null);
    }, [store]);

    const handleZoomIn = useCallback(() => {
      store.setZoom(Math.min(zoom + ZOOM_STEP, ZOOM_MAX));
    }, [store, zoom]);

    const handleZoomOut = useCallback(() => {
      store.setZoom(Math.max(zoom - ZOOM_STEP, ZOOM_MIN));
    }, [store, zoom]);

    const handleZoomReset = useCallback(() => {
      store.setZoom(100);
      setPanOffset({ x: 0, y: 0 });
    }, [store]);

    const handleViewportChange = useCallback(
      (v: ViewportSize) => {
        store.setViewport(v);
      },
      [store]
    );

    const handleToggleGrid = useCallback(() => {
      const newCanvas = { ...store.canvas, showGrid: !store.canvas.showGrid };
      useZDesignStore.setState({ canvas: newCanvas });
    }, [store]);

    const handleToggleAnnotations = useCallback(() => {
      const newCanvas = { ...store.canvas, showAnnotations: !store.canvas.showAnnotations };
      useZDesignStore.setState({ canvas: newCanvas });
    }, [store]);

    const handleFullscreen = useCallback(() => {
      if (canvasRef.current) {
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          canvasRef.current.requestFullscreen();
        }
      }
    }, []);

    const handleAnnotationClick = useCallback(
      (x: number, y: number) => {
        onAnnotationClick?.(x, y);
      },
      [onAnnotationClick]
    );

    // ---- Drag-to-move handler ----
    const handleMove = useCallback(
      (nodeId: string, deltaX: number, deltaY: number) => {
        // Use nudgeNode with the pixel delta
        store.nudgeNode(nodeId, deltaX, deltaY);
      },
      [store]
    );

    // ---- Drag-to-resize handler ----
    const handleResize = useCallback(
      (nodeId: string, newStyle: Partial<import('@/types/design').DesignStyle>) => {
        store.updateNode(nodeId, { style: { ...(findNodeById(node, nodeId)?.style ?? {}), ...newStyle } });
      },
      [store, node]
    );

    // Find selected node for the overlay
    const selectedNode = useMemo(() => {
      if (!selectedId) return null;
      return findNodeById(node, selectedId);
    }, [node, selectedId]);

    // Cursor style for panning
    const canvasCursor = isPanning
      ? 'grabbing'
      : spaceHeld
        ? 'grab'
        : undefined;

    return (
      <div
        ref={canvasRef}
        className="relative flex h-full w-full flex-col overflow-hidden"
        style={{ cursor: canvasCursor }}
        onMouseDown={handleCanvasMouseDown}
      >
        {/* Viewport Frame with pan support */}
        <ViewportFrame
          viewport={viewport}
          zoom={zoom}
          showGrid={showGrid}
          panX={panOffset.x}
          panY={panOffset.y}
        >
          {/* Render the design tree */}
          <NodeRenderer
            node={node}
            selectedId={selectedId}
            hoveredId={hoveredId}
            onSelect={handleSelect}
            onHover={handleHover}
            depth={0}
          />

          {/* Annotation Pins */}
          {showAnnotations && annotations.length > 0 && (
            <div className="pointer-events-none absolute inset-0">
              {annotations.map((annotation: Annotation, index: number) => (
                <div key={annotation.id} className="pointer-events-auto">
                  <AnnotationPin
                    annotation={annotation}
                    index={index}
                    onResolve={store.resolveAnnotation}
                    onClick={() => handleAnnotationClick(annotation.x, annotation.y)}
                  />
                </div>
              ))}
            </div>
          )}
        </ViewportFrame>

        {/* Selection Overlay */}
        {selectedId && selectedNode && (
          <SelectionOverlay
            nodeId={selectedId}
            nodeType={selectedNode.type}
            nodeName={selectedNode.meta?.name}
            nodeStyle={selectedNode.style}
            rect={selectionRect}
            containerRect={containerRect}
            onDelete={handleDelete}
            onDeselect={handleDeselect}
            onMove={handleMove}
            onResize={handleResize}
          />
        )}

        {/* Canvas Toolbar */}
        <CanvasToolbar
          zoom={zoom}
          viewport={viewport}
          showGrid={showGrid}
          showAnnotations={showAnnotations}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onZoomReset={handleZoomReset}
          onViewportChange={handleViewportChange}
          onToggleGrid={handleToggleGrid}
          onToggleAnnotations={handleToggleAnnotations}
          onFullscreen={handleFullscreen}
        />
      </div>
    );
  }
);

DesignRenderer.displayName = 'DesignRenderer';

// ============ Helper: Find Node by ID ============

function findNodeById(tree: DesignNode, id: string): DesignNode | null {
  if (tree.id === id) return tree;
  if (tree.children) {
    for (const child of tree.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
  }
  return null;
}

export default DesignRenderer;
