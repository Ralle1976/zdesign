// Z.Design - Accessibility Scanning Utility
// Works offline - no API calls needed

import type { DesignNode, DesignStyle } from '@/types/design';

// ============ Types ============

export type A11ySeverity = 'critical' | 'warning' | 'info';

export interface AccessibilityIssue {
  id: string;
  severity: A11ySeverity;
  category: A11yCategory;
  elementId: string;
  elementType: string;
  elementName?: string;
  description: string;
  suggestion: string;
  autoFixable: boolean;
  autoFix?: (node: DesignNode) => DesignNode;
}

export type A11yCategory =
  | 'contrast'
  | 'alt-text'
  | 'labels'
  | 'headings'
  | 'touch-target'
  | 'semantics';

// ============ Color Parsing & Contrast ============

/**
 * Parse a CSS color string to RGB values.
 * Supports hex (#rgb, #rrggbb), rgb(), rgba(), and named colors.
 */
export function parseColor(color: string): { r: number; g: number; b: number } | null {
  if (!color || typeof color !== 'string') return null;

  const trimmed = color.trim().toLowerCase();

  // Hex formats
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  // rgb() / rgba()
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/
  );
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
    };
  }

  // Named colors (common subset)
  const namedColors: Record<string, string> = {
    white: '#ffffff',
    black: '#000000',
    red: '#ff0000',
    green: '#008000',
    blue: '#0000ff',
    yellow: '#ffff00',
    orange: '#ffa500',
    purple: '#800080',
    gray: '#808080',
    grey: '#808080',
    silver: '#c0c0c0',
    maroon: '#800000',
    olive: '#808000',
    lime: '#00ff00',
    aqua: '#00ffff',
    teal: '#008080',
    navy: '#000080',
    fuchsia: '#ff00ff',
    pink: '#ffc0cb',
    salmon: '#fa8072',
    coral: '#ff7f50',
    tomato: '#ff6347',
    gold: '#ffd700',
    ivory: '#fffff0',
    lavender: '#e6e6fa',
    beige: '#f5f5dc',
    khaki: '#f0e68c',
    crimson: '#dc143c',
  };

  if (namedColors[trimmed]) {
    return parseColor(namedColors[trimmed]);
  }

  return null;
}

/**
 * Calculate relative luminance per WCAG 2.0
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors per WCAG 2.0
 * Returns a ratio like 4.5 (meaning 4.5:1)
 */
export function calculateContrastRatio(fg: string, bg: string): number {
  const fgRgb = parseColor(fg);
  const bgRgb = parseColor(bg);

  if (!fgRgb || !bgRgb) return 21; // Assume maximum contrast if we can't parse

  const fgL = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgL = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);

  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);

  return (lighter + 0.05) / (darker + 0.05);
}

// ============ Size Parsing ============

function parsePixelValue(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)(px)?$/);
  if (match) return parseFloat(match[1]);
  return null;
}

// ============ Design Tree Scanner ============

let issueCounter = 0;

function createIssue(
  severity: A11ySeverity,
  category: A11yCategory,
  elementId: string,
  elementType: string,
  elementName: string | undefined,
  description: string,
  suggestion: string,
  autoFixable: boolean,
  autoFix?: (node: DesignNode) => DesignNode
): AccessibilityIssue {
  issueCounter++;
  return {
    id: `a11y-${issueCounter}`,
    severity,
    category,
    elementId,
    elementType,
    elementName,
    description,
    suggestion,
    autoFixable,
    autoFix,
  };
}

/**
 * Scan a design tree for accessibility issues.
 */
export function scanDesignTree(tree: DesignNode): AccessibilityIssue[] {
  issueCounter = 0;
  const issues: AccessibilityIssue[] = [];
  const headingLevels: { level: number; id: string; name?: string }[] = [];

  function traverse(node: DesignNode, parentBgColor: string | null, parentStyle?: DesignStyle): void {
    const style = { ...parentStyle, ...node.style };
    const bgColor = style.backgroundColor || parentBgColor;
    const textColor = style.color;
    const name = node.meta?.name || node.meta?.a11yLabel;

    // 1. Color Contrast Check
    if (textColor && bgColor) {
      const ratio = calculateContrastRatio(textColor, bgColor);

      if (node.type === 'text' || node.type === 'heading' || node.type === 'button') {
        // WCAG large text: >= 18pt (24px) OR >= 14pt (18.66px) with bold weight
        const fontSizePx = parsePixelValue(style.fontSize);
        const fontWeight = parseInt(style.fontWeight || '400');
        const isLargeText =
          (fontSizePx !== null && fontSizePx >= 24) ||
          (fontSizePx !== null && fontSizePx >= 18 && fontWeight >= 700);

        const aaThreshold = isLargeText ? 3 : 4.5;
        const aaaThreshold = isLargeText ? 4.5 : 7;

        if (ratio < aaThreshold) {
          issues.push(
            createIssue(
              'critical',
              'contrast',
              node.id,
              node.type,
              name,
              `Contrast ratio ${ratio.toFixed(1)}:1 is below WCAG AA minimum (${aaThreshold}:1)`,
              `Increase contrast between text color (${textColor}) and background (${bgColor})`,
              false
            )
          );
        } else if (ratio < aaaThreshold) {
          issues.push(
            createIssue(
              'warning',
              'contrast',
              node.id,
              node.type,
              name,
              `Contrast ratio ${ratio.toFixed(1)}:1 meets WCAG AA but not AAA (${aaaThreshold}:1)`,
              `Consider increasing contrast for enhanced accessibility`,
              false
            )
          );
        }
      }
    }

    // 2. Missing Alt Text for Images
    // Note: node.content on images is typically the src URL, not alt text
    if (node.type === 'image') {
      if (!node.meta?.alt && !node.meta?.description && !node.meta?.a11yLabel && !node.meta?.ariaLabel) {
        issues.push(
          createIssue(
            'critical',
            'alt-text',
            node.id,
            node.type,
            name,
            'Image is missing alternative text',
            'Add descriptive alt text for screen readers',
            true,
            (n: DesignNode) => ({
              ...n,
              meta: { ...n.meta, a11yLabel: 'Image description needed', description: 'Image description needed' },
            })
          )
        );
      }
    }

    // 3. Missing Labels for Form Inputs
    if (node.type === 'input' || node.type === 'toggle' || node.type === 'slider') {
      if (!node.meta?.a11yLabel && !node.meta?.ariaLabel && !node.content && !node.props?.['aria-label'] && !node.props?.['placeholder']) {
        issues.push(
          createIssue(
            'critical',
            'labels',
            node.id,
            node.type,
            name,
            `Form ${node.type} is missing an accessible label`,
            'Add an aria-label or associate a label element',
            true,
            (n: DesignNode) => ({
              ...n,
              meta: { ...n.meta, a11yLabel: `${n.type} label needed` },
              props: { ...n.props, placeholder: `Enter ${n.type}...` },
            })
          )
        );
      }
    }

    // 4. Heading Hierarchy
    if (node.type === 'heading') {
      // Determine heading level from tag (e.g., "h1" -> 1) or componentRef
      let level = 1;
      if (node.tag && /^h[1-6]$/.test(node.tag)) {
        level = parseInt(node.tag.replace('h', ''), 10);
      } else if (node.meta?.componentRef) {
        const parsed = parseInt(node.meta.componentRef.replace(/\D/g, ''), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 6) {
          level = parsed;
        }
      }

      if (level >= 1 && level <= 6) {
        headingLevels.push({ level, id: node.id, name });
      }
    }

    // 5. Touch Target Size
    if (
      node.type === 'button' ||
      node.type === 'link' ||
      node.type === 'input' ||
      node.type === 'toggle'
    ) {
      const width = parsePixelValue(style.width || style.minWidth);
      const height = parsePixelValue(style.height || style.minHeight);
      const paddingV = parsePixelValue(style.paddingTop || style.padding);
      const paddingH = parsePixelValue(style.paddingLeft || style.padding);

      const effectiveWidth = (width ?? 0) + (paddingH ?? 0) * 2;
      const effectiveHeight = (height ?? 0) + (paddingV ?? 0) * 2;

      // Only check if we have explicit size info
      if (width !== null || height !== null) {
        if (effectiveWidth > 0 && effectiveWidth < 44) {
          issues.push(
            createIssue(
              'warning',
              'touch-target',
              node.id,
              node.type,
              name,
              `Touch target width (${effectiveWidth}px) is below minimum 44px`,
              'Increase the width or padding to at least 44px',
              false
            )
          );
        }
        if (effectiveHeight > 0 && effectiveHeight < 44) {
          issues.push(
            createIssue(
              'warning',
              'touch-target',
              node.id,
              node.type,
              name,
              `Touch target height (${effectiveHeight}px) is below minimum 44px`,
              'Increase the height or padding to at least 44px',
              false
            )
          );
        }
      }
    }

    // 6. Semantic HTML Checks
    if (node.type === 'nav' && !node.meta?.a11yRole && !node.meta?.role && !node.meta?.ariaLabel && !node.meta?.a11yLabel) {
      // Nav should have an aria-label if there are multiple navs
      // Just flag it as info
      issues.push(
        createIssue(
          'info',
          'semantics',
          node.id,
          node.type,
          name,
          'Navigation element should have a descriptive aria-label',
          'Add aria-label like "Main navigation" or "Footer navigation"',
          true,
          (n: DesignNode) => ({
            ...n,
            meta: { ...n.meta, a11yRole: 'navigation', a11yLabel: 'Navigation' },
          })
        )
      );
    }

    if (node.type === 'image' && node.style?.backgroundImage && !node.meta?.a11yLabel && !node.meta?.ariaLabel && !node.meta?.alt) {
      issues.push(
        createIssue(
          'warning',
          'alt-text',
          node.id,
          node.type,
          name,
          'Decorative image should be marked with alt="" or have a descriptive label',
          'If decorative, add empty alt text. If meaningful, add a description',
          true,
          (n: DesignNode) => ({
            ...n,
            meta: { ...n.meta, a11yRole: 'img', a11yLabel: '' },
          })
        )
      );
    }

    // Check for section without heading - only flag if no ariaLabel is set
    if (node.type === 'section' && node.children) {
      const hasHeading = node.children.some(
        (child) => child.type === 'heading'
      );
      const hasAriaLabel = node.meta?.ariaLabel || node.meta?.a11yLabel;
      if (!hasHeading && !hasAriaLabel) {
        issues.push(
          createIssue(
            'info',
            'semantics',
            node.id,
            node.type,
            name,
            'Section element should contain a heading for screen reader navigation',
            'Add a heading element (h2-h6) as the first child of this section',
            false
          )
        );
      }
    }

    // Check for list without list items
    if (node.type === 'list' && node.children) {
      const hasListItems = node.children.some((child) =>
        ['text', 'link', 'badge'].includes(child.type)
      );
      if (!hasListItems && node.children.length === 0) {
        issues.push(
          createIssue(
            'info',
            'semantics',
            node.id,
            node.type,
            name,
            'Empty list element',
            'Add list items or remove the empty list',
            false
          )
        );
      }
    }

    // Recurse into children
    if (node.children) {
      for (const child of node.children) {
        traverse(child, bgColor, style);
      }
    }
  }

  traverse(tree, '#ffffff');

  // Post-scan: Check heading hierarchy
  if (headingLevels.length > 1) {
    for (let i = 1; i < headingLevels.length; i++) {
      const prev = headingLevels[i - 1];
      const curr = headingLevels[i];
      // Skipped level (e.g., h1 -> h3 without h2)
      if (curr.level > prev.level + 1) {
        issues.push(
          createIssue(
            'warning',
            'headings',
            curr.id,
            'heading',
            curr.name,
            `Heading level h${curr.level} skips from h${prev.level} — should not skip levels`,
            `Use h${prev.level + 1} instead of h${curr.level}, or add an intermediate heading`,
            false
          )
        );
      }
    }
  }

  // Check for missing h1
  if (headingLevels.length > 0 && !headingLevels.some((h) => h.level === 1)) {
    issues.push(
      createIssue(
        'warning',
        'headings',
        headingLevels[0].id,
        'heading',
        headingLevels[0].name,
        'Page has headings but no h1 — every page should have exactly one h1',
        'Make the main heading an h1 element',
        false
      )
    );
  }

  return issues;
}

// ============ Score Calculation ============

/**
 * Calculate an accessibility score from 0-100 based on issues found.
 *
 * Uses a proportional scoring system that doesn't collapse to 0
 * on large design trees with many minor issues. Each category
 * is scored independently (0-100), then averaged with weights.
 */
export function calculateAccessibilityScore(issues: AccessibilityIssue[]): number {
  if (issues.length === 0) return 100;

  // Group issues by category and calculate per-category scores
  const categories: Record<A11yCategory, { critical: number; warning: number; info: number }> = {
    contrast: { critical: 0, warning: 0, info: 0 },
    'alt-text': { critical: 0, warning: 0, info: 0 },
    labels: { critical: 0, warning: 0, info: 0 },
    headings: { critical: 0, warning: 0, info: 0 },
    'touch-target': { critical: 0, warning: 0, info: 0 },
    semantics: { critical: 0, warning: 0, info: 0 },
  };

  for (const issue of issues) {
    const cat = categories[issue.category];
    if (cat) {
      cat[issue.severity]++;
    }
  }

  // Score each category: start at 100, deduct per issue but cap deductions per category
  // This prevents a single category from completely tanking the overall score
  const categoryWeights: Record<A11yCategory, number> = {
    contrast: 0.30,    // Most impactful for users
    'alt-text': 0.20,  // Critical for screen readers
    labels: 0.20,      // Critical for forms
    headings: 0.10,    // Important for navigation
    'touch-target': 0.10, // Important for mobile
    semantics: 0.10,   // Nice to have
  };

  let overallScore = 0;

  for (const [catName, catIssues] of Object.entries(categories)) {
    const weight = categoryWeights[catName as A11yCategory] ?? 0.1;

    // Per-category deduction: critical = 20, warning = 10, info = 3
    // But cap total deduction at 100 per category (score floor = 0 per category)
    const deduction = Math.min(
      100,
      catIssues.critical * 20 + catIssues.warning * 10 + catIssues.info * 3
    );
    const catScore = Math.max(0, 100 - deduction);

    overallScore += catScore * weight;
  }

  return Math.round(overallScore);
}

/**
 * Get a color for the accessibility score.
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

/**
 * Get a background color for the accessibility score.
 */
export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 dark:bg-emerald-900/30';
  if (score >= 50) return 'bg-amber-100 dark:bg-amber-900/30';
  return 'bg-red-100 dark:bg-red-900/30';
}

/**
 * Get a ring color for the accessibility score circle.
 */
export function getScoreRingColor(score: number): string {
  if (score >= 80) return 'stroke-emerald-500';
  if (score >= 50) return 'stroke-amber-500';
  return 'stroke-red-500';
}
