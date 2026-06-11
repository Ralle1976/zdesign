import type { DesignStyle } from '@/types/design';
import type { CSSProperties } from 'react';

/**
 * Maps a DesignStyle object to React CSSProperties.
 * Handles special cases for flex, grid, colors, spacing, and custom values.
 */
export function mapDesignStyleToCSS(style?: DesignStyle): CSSProperties {
  if (!style) return {};

  const css: CSSProperties = {};

  // Layout
  if (style.display) css.display = style.display as CSSProperties['display'];
  if (style.flexDirection) css.flexDirection = style.flexDirection as CSSProperties['flexDirection'];
  if (style.flexWrap) css.flexWrap = style.flexWrap as CSSProperties['flexWrap'];
  if (style.justifyContent) css.justifyContent = style.justifyContent as CSSProperties['justifyContent'];
  if (style.alignItems) css.alignItems = style.alignItems as CSSProperties['alignItems'];
  if (style.gap) css.gap = style.gap;
  if (style.gridTemplateColumns) css.gridTemplateColumns = style.gridTemplateColumns;
  if (style.gridTemplateRows) css.gridTemplateRows = style.gridTemplateRows;
  if (style.gridArea) css.gridArea = style.gridArea;
  if (style.position) css.position = style.position as CSSProperties['position'];
  if (style.top) css.top = style.top;
  if (style.right) css.right = style.right;
  if (style.bottom) css.bottom = style.bottom;
  if (style.left) css.left = style.left;
  if (style.zIndex !== undefined) css.zIndex = style.zIndex;

  // Sizing
  if (style.width) css.width = style.width;
  if (style.height) css.height = style.height;
  if (style.minWidth) css.minWidth = style.minWidth;
  if (style.minHeight) css.minHeight = style.minHeight;
  if (style.maxWidth) css.maxWidth = style.maxWidth;
  if (style.maxHeight) css.maxHeight = style.maxHeight;

  // Spacing - shorthand
  if (style.padding) css.padding = style.padding;
  if (style.paddingTop) css.paddingTop = style.paddingTop;
  if (style.paddingRight) css.paddingRight = style.paddingRight;
  if (style.paddingBottom) css.paddingBottom = style.paddingBottom;
  if (style.paddingLeft) css.paddingLeft = style.paddingLeft;
  if (style.margin) css.margin = style.margin;
  if (style.marginTop) css.marginTop = style.marginTop;
  if (style.marginRight) css.marginRight = style.marginRight;
  if (style.marginBottom) css.marginBottom = style.marginBottom;
  if (style.marginLeft) css.marginLeft = style.marginLeft;

  // Typography
  if (style.fontFamily) css.fontFamily = style.fontFamily;
  if (style.fontSize) css.fontSize = style.fontSize;
  if (style.fontWeight) css.fontWeight = style.fontWeight;
  if (style.lineHeight) css.lineHeight = style.lineHeight;
  if (style.letterSpacing) css.letterSpacing = style.letterSpacing;
  if (style.textAlign) css.textAlign = style.textAlign as CSSProperties['textAlign'];
  if (style.textDecoration) css.textDecoration = style.textDecoration as CSSProperties['textDecoration'];
  if (style.textTransform) css.textTransform = style.textTransform as CSSProperties['textTransform'];
  if (style.color) css.color = style.color;

  // Background
  if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
  if (style.backgroundImage) css.backgroundImage = style.backgroundImage;
  if (style.backgroundSize) css.backgroundSize = style.backgroundSize;
  if (style.backgroundPosition) css.backgroundPosition = style.backgroundPosition;
  if (style.backgroundRepeat) css.backgroundRepeat = style.backgroundRepeat as CSSProperties['backgroundRepeat'];

  // Border
  if (style.border) css.border = style.border;
  if (style.borderWidth) css.borderWidth = style.borderWidth;
  if (style.borderStyle) css.borderStyle = style.borderStyle as CSSProperties['borderStyle'];
  if (style.borderColor) css.borderColor = style.borderColor;
  if (style.borderRadius) css.borderRadius = style.borderRadius;

  // Effects
  if (style.boxShadow) css.boxShadow = style.boxShadow;
  if (style.opacity !== undefined) css.opacity = style.opacity;
  if (style.transform) css.transform = style.transform;
  if (style.transition) css.transition = style.transition;
  if (style.filter) css.filter = style.filter;
  if (style.backdropFilter) css.backdropFilter = style.backdropFilter;

  // Overflow
  if (style.overflow) css.overflow = style.overflow as CSSProperties['overflow'];
  if (style.overflowX) css.overflowX = style.overflowX as CSSProperties['overflowX'];
  if (style.overflowY) css.overflowY = style.overflowY as CSSProperties['overflowY'];

  // Custom properties — handle any additional keys not in the standard DesignStyle
  const knownKeys = new Set([
    'display', 'flexDirection', 'flexWrap', 'justifyContent', 'alignItems',
    'gap', 'gridTemplateColumns', 'gridTemplateRows', 'gridArea',
    'position', 'top', 'right', 'bottom', 'left', 'zIndex',
    'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing',
    'textAlign', 'textDecoration', 'textTransform', 'color',
    'backgroundColor', 'backgroundImage', 'backgroundSize',
    'backgroundPosition', 'backgroundRepeat',
    'border', 'borderWidth', 'borderStyle', 'borderColor', 'borderRadius',
    'boxShadow', 'opacity', 'transform', 'transition', 'filter', 'backdropFilter',
    'overflow', 'overflowX', 'overflowY',
  ]);

  for (const [key, value] of Object.entries(style)) {
    if (!knownKeys.has(key) && value !== undefined && value !== null && typeof value === 'string') {
      // Convert camelCase to kebab-case for custom CSS properties
      const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`) as keyof CSSProperties;
      (css as Record<string, unknown>)[cssKey] = value;
    }
  }

  return css;
}

/**
 * Merges base styles with override styles, where override takes precedence.
 */
export function mergeStyles(
  base: DesignStyle | undefined,
  override: DesignStyle | undefined
): DesignStyle {
  if (!base) return override ?? {};
  if (!override) return base;
  return { ...base, ...override };
}
