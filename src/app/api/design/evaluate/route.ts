// Z.Design - Quality Evaluation API
// Evaluates a design tree and returns a comprehensive DesignQualityReport
// Pure rule-based — no LLM calls needed

import { NextRequest, NextResponse } from 'next/server';

// ============ Types ============

interface DesignNode {
  id: string;
  type: string;
  tag?: string;
  content?: string;
  children?: DesignNode[];
  style?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

interface QualityIssue {
  severity: 'critical' | 'warning' | 'info';
  category: 'css' | 'semantics' | 'responsiveness' | 'accessibility' | 'completeness';
  message: string;
  nodeId?: string;
  autoFixable: boolean;
}

interface QualityReport {
  overallScore: number;
  completeness: number;
  cssValid: number;
  semantics: number;
  responsiveness: number;
  accessibility: number;
  issues: QualityIssue[];
  suggestions: string[];
}

// ============ Helper Functions ============

function findNodesByType(node: DesignNode, type: string): DesignNode[] {
  const result: DesignNode[] = [];
  function traverse(n: DesignNode) {
    if (n.type === type) result.push(n);
    n.children?.forEach(traverse);
  }
  traverse(node);
  return result;
}

function countNodes(node: DesignNode): number {
  let count = 1;
  node.children?.forEach(child => { count += countNodes(child); });
  return count;
}

function findAllNodes(node: DesignNode): DesignNode[] {
  const result: DesignNode[] = [];
  function traverse(n: DesignNode) {
    result.push(n);
    n.children?.forEach(traverse);
  }
  traverse(node);
  return result;
}

// ============ Evaluators ============

// Evaluate completeness: Does the design have proper sections?
function evaluateCompleteness(node: DesignNode): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  // Check if root has children
  if (!node.children || node.children.length === 0) {
    return { score: 0, issues: [{ severity: 'critical', category: 'completeness', message: 'Design is empty', nodeId: node.id, autoFixable: false }] };
  }

  // Check for common sections based on content
  const hasNav = node.children.some(c => c.type === 'nav' || c.type === 'header' || c.tag === 'nav' || c.tag === 'header');
  const hasFooter = node.children.some(c => c.type === 'footer' || c.tag === 'footer');
  const hasSection = node.children.some(c => c.type === 'section' || c.tag === 'section');
  const hasHeading = findNodesByType(node, 'heading').length > 0;
  const hasButton = findNodesByType(node, 'button').length > 0;
  const hasText = findNodesByType(node, 'text').length > 0;

  if (!hasNav) {
    score -= 10;
    issues.push({ severity: 'warning', category: 'completeness', message: 'Missing navigation/header section', autoFixable: false });
  }
  if (!hasFooter) {
    score -= 5;
    issues.push({ severity: 'info', category: 'completeness', message: 'Missing footer section', autoFixable: false });
  }
  if (!hasSection) {
    score -= 15;
    issues.push({ severity: 'warning', category: 'completeness', message: 'No content sections found', autoFixable: false });
  }
  if (!hasHeading) {
    score -= 15;
    issues.push({ severity: 'critical', category: 'completeness', message: 'No headings found — design needs text hierarchy', autoFixable: false });
  }
  if (!hasButton) {
    score -= 5;
    issues.push({ severity: 'info', category: 'completeness', message: 'No call-to-action buttons found', autoFixable: false });
  }
  if (!hasText) {
    score -= 10;
    issues.push({ severity: 'warning', category: 'completeness', message: 'No text content found', autoFixable: false });
  }

  // Check for very few nodes (likely incomplete design)
  const totalNodes = countNodes(node);
  if (totalNodes < 5) {
    score -= 20;
    issues.push({ severity: 'critical', category: 'completeness', message: 'Design has very few elements — likely incomplete', autoFixable: false });
  } else if (totalNodes < 10) {
    score -= 10;
    issues.push({ severity: 'warning', category: 'completeness', message: 'Design seems sparse — consider adding more content', autoFixable: false });
  }

  return { score: Math.max(0, score), issues };
}

// Evaluate CSS validity: Are style values proper CSS?
function evaluateCSS(node: DesignNode): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  function traverse(n: DesignNode) {
    if (n.style) {
      for (const [key, value] of Object.entries(n.style)) {
        if (typeof value === 'string') {
          // Detect Tailwind-like shorthand values (WRONG in our system)
          if (/^(xs|sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|full|max|min|fit|auto|px|py|mx|my|p|m)$/.test(value) && !value.includes(' ') && !value.includes('%') && !value.includes('px') && !value.includes('rem') && !value.includes('em') && !value.includes('vh') && !value.includes('vw') && !value.includes('#') && !value.includes('rgb')) {
            score -= 5;
            issues.push({ severity: 'critical', category: 'css', message: `Property "${key}" has invalid CSS value "${value}" — use real CSS values like "16px" or "1rem"`, nodeId: n.id, autoFixable: true });
          }

          // Check for empty values
          if (value === '' || value === 'undefined' || value === 'null') {
            score -= 3;
            issues.push({ severity: 'warning', category: 'css', message: `Property "${key}" has empty/invalid value`, nodeId: n.id, autoFixable: true });
          }
        }
      }

      // Check for missing font-family on root
      if (n.type === 'root' && !n.style.fontFamily) {
        score -= 3;
        issues.push({ severity: 'info', category: 'css', message: 'Root element missing font-family — add a default font', nodeId: n.id, autoFixable: true });
      }
    }
    n.children?.forEach(traverse);
  }

  traverse(node);
  return { score: Math.max(0, score), issues };
}

// Evaluate semantics: Proper HTML tags, heading hierarchy, etc.
function evaluateSemantics(node: DesignNode): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  function traverse(n: DesignNode) {
    // Check for div-itis (too many generic divs)
    if (n.tag === 'div' && n.type !== 'root' && n.type !== 'container' && n.type !== 'flex' && n.type !== 'grid') {
      // Could use a semantic tag instead
      if (n.meta?.name && /nav|header|footer|main|section|article|aside/i.test(String(n.meta.name))) {
        score -= 3;
        issues.push({ severity: 'info', category: 'semantics', message: `Element "${n.meta.name}" uses <div> but should use a semantic tag`, nodeId: n.id, autoFixable: false });
      }
    }

    // Check heading hierarchy
    if (n.type === 'heading') {
      const tag = n.tag || 'h2';
      const level = parseInt(tag.replace('h', ''), 10);
      if (level > 3 && n.children === undefined) {
        // Deep heading with no children might be too deep
        score -= 2;
      }
    }

    // Check for missing meta.name on sections
    if ((n.type === 'section' || n.type === 'nav' || n.type === 'header' || n.type === 'footer') && !n.meta?.name) {
      score -= 2;
      issues.push({ severity: 'info', category: 'semantics', message: `${n.type} element missing meta.name — hard to identify in the design tree`, nodeId: n.id, autoFixable: true });
    }

    n.children?.forEach(traverse);
  }

  traverse(node);
  return { score: Math.max(0, score), issues };
}

// Evaluate responsiveness: flexbox/grid usage, relative units
function evaluateResponsiveness(node: DesignNode): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  function traverse(n: DesignNode) {
    if (n.style) {
      // Check for fixed widths on containers
      if (n.style.width && typeof n.style.width === 'string') {
        const w = n.style.width;
        if (/^\d+px$/.test(w) && parseInt(w) > 600 && (n.type === 'section' || n.type === 'root' || n.type === 'container')) {
          score -= 5;
          issues.push({ severity: 'warning', category: 'responsiveness', message: `Container has fixed width ${w} — use maxWidth or relative units for responsiveness`, nodeId: n.id, autoFixable: false });
        }
      }

      // Check for flex/grid usage
      if (n.children && n.children.length > 1) {
        const hasLayout = n.style.display === 'flex' || n.style.display === 'grid';
        if (!hasLayout && n.type !== 'heading' && n.type !== 'text' && n.type !== 'button') {
          score -= 3;
          issues.push({ severity: 'info', category: 'responsiveness', message: `Element with ${n.children.length} children has no flex/grid layout — children may not arrange properly`, nodeId: n.id, autoFixable: false });
        }
      }

      // Check for hardcoded font sizes on root (should use relative)
      if (n.type === 'root' && n.style.fontSize && /px/.test(String(n.style.fontSize)) && parseInt(String(n.style.fontSize)) > 20) {
        score -= 2;
        issues.push({ severity: 'info', category: 'responsiveness', message: 'Root font-size is hardcoded in px — consider using rem for better scaling', nodeId: n.id, autoFixable: false });
      }
    }
    n.children?.forEach(traverse);
  }

  traverse(node);
  return { score: Math.max(0, score), issues };
}

// ============ WCAG Contrast Helpers (Server-Side) ============

function parseColorServer(color: string): { r: number; g: number; b: number } | null {
  if (!color || typeof color !== 'string') return null;
  const trimmed = color.trim().toLowerCase();

  // Hex formats
  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    if (hex.length === 3) {
      return { r: parseInt(hex[0] + hex[0], 16), g: parseInt(hex[1] + hex[1], 16), b: parseInt(hex[2] + hex[2], 16) };
    }
    if (hex.length === 6) {
      return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16) };
    }
    return null;
  }

  // rgb() / rgba()
  const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgbMatch) {
    return { r: parseInt(rgbMatch[1], 10), g: parseInt(rgbMatch[2], 10), b: parseInt(rgbMatch[3], 10) };
  }

  return null;
}

function relativeLuminanceServer(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatioServer(fg: string, bg: string): number {
  const fgRgb = parseColorServer(fg);
  const bgRgb = parseColorServer(bg);
  if (!fgRgb || !bgRgb) return 21; // Assume maximum contrast if we can't parse
  const fgL = relativeLuminanceServer(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgL = relativeLuminanceServer(bgRgb.r, bgRgb.g, bgRgb.b);
  const lighter = Math.max(fgL, bgL);
  const darker = Math.min(fgL, bgL);
  return (lighter + 0.05) / (darker + 0.05);
}

function parsePixelValueServer(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d+(?:\.\d+)?)(px)?$/);
  if (match) return parseFloat(match[1]);
  return null;
}

// Evaluate accessibility: alt text, labels, contrast, ARIA
function evaluateAccessibility(node: DesignNode): { score: number; issues: QualityIssue[] } {
  const issues: QualityIssue[] = [];
  let score = 100;

  const allNodes = findAllNodes(node);

  // Check images for alt text (content is typically the src URL, not alt text)
  const images = findNodesByType(node, 'image');
  for (const img of images) {
    if (!img.meta?.alt && !img.meta?.description && !img.meta?.ariaLabel) {
      score -= 5;
      issues.push({ severity: 'warning', category: 'accessibility', message: `Image element missing alt text`, nodeId: img.id, autoFixable: true });
    }
  }

  // Check buttons for accessible labels
  const buttons = findNodesByType(node, 'button');
  for (const btn of buttons) {
    if (!btn.content && !btn.meta?.ariaLabel && !btn.meta?.label) {
      score -= 5;
      issues.push({ severity: 'warning', category: 'accessibility', message: `Button missing accessible label`, nodeId: btn.id, autoFixable: true });
    }
  }

  // Check for links without content
  const links = findNodesByType(node, 'link');
  for (const link of links) {
    if (!link.content && !link.meta?.ariaLabel) {
      score -= 3;
      issues.push({ severity: 'info', category: 'accessibility', message: `Link element missing text content or aria-label`, nodeId: link.id, autoFixable: true });
    }
  }

  // Check for inputs without labels
  const inputs = findNodesByType(node, 'input');
  for (const input of inputs) {
    if (!input.meta?.label && !input.meta?.ariaLabel && !input.meta?.placeholder) {
      score -= 5;
      issues.push({ severity: 'warning', category: 'accessibility', message: `Input field missing label or placeholder`, nodeId: input.id, autoFixable: true });
    }
  }

  // Check heading hierarchy — should start with h1
  const headings = findNodesByType(node, 'heading');
  if (headings.length > 0) {
    const h1Exists = headings.some(h => h.tag === 'h1');
    if (!h1Exists) {
      score -= 5;
      issues.push({ severity: 'info', category: 'accessibility', message: 'No h1 heading found — pages should have a main heading', autoFixable: false });
    }

    // Check for skipped heading levels
    const levels = headings.map(h => parseInt((h.tag || 'h2').replace('h', ''), 10)).filter(l => !isNaN(l)).sort((a, b) => a - b);
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        score -= 2;
        issues.push({ severity: 'info', category: 'accessibility', message: `Heading level skipped from h${levels[i - 1]} to h${levels[i]} — maintain proper hierarchy`, autoFixable: false });
        break; // Only report once
      }
    }
  }

  // Check nav elements for aria-labels
  const navs = findNodesByType(node, 'nav');
  for (const nav of navs) {
    if (!nav.meta?.ariaLabel && !nav.meta?.a11yLabel) {
      score -= 3;
      issues.push({ severity: 'info', category: 'accessibility', message: `Navigation element missing aria-label`, nodeId: nav.id, autoFixable: true });
    }
  }

  // Check sections without headings
  const sections = findNodesByType(node, 'section');
  for (const section of sections) {
    if (section.children && !section.children.some(c => c.type === 'heading')) {
      score -= 2;
      issues.push({ severity: 'info', category: 'accessibility', message: `Section element should contain a heading for screen reader navigation`, nodeId: section.id, autoFixable: false });
    }
  }

  // Check color contrast using actual WCAG contrast ratio calculation
  let lowContrastCount = 0;
  let mediumContrastCount = 0;

  // Build a map of background colors by walking the tree
  function findBgColor(n: DesignNode, parentBg: string | null): string | null {
    const bg = n.style?.backgroundColor ? String(n.style.backgroundColor) : parentBg;
    return bg;
  }

  function traverseForContrast(n: DesignNode, parentBg: string | null) {
    const bg = findBgColor(n, parentBg);
    const textColor = n.style?.color ? String(n.style.color) : null;

    if (textColor && bg && (n.type === 'text' || n.type === 'heading' || n.type === 'button')) {
      const ratio = contrastRatioServer(textColor, bg);

      // Determine large text threshold
      const fontSizePx = parsePixelValueServer(n.style?.fontSize as string | undefined);
      const fontWeight = parseInt((n.style?.fontWeight as string) || '400');
      const isLargeText =
        (fontSizePx !== null && fontSizePx >= 24) ||
        (fontSizePx !== null && fontSizePx >= 18 && fontWeight >= 700);

      const aaThreshold = isLargeText ? 3 : 4.5;

      if (ratio < aaThreshold) {
        lowContrastCount++;
      } else if (ratio < (isLargeText ? 4.5 : 7)) {
        mediumContrastCount++;
      }
    }

    n.children?.forEach(child => traverseForContrast(child, bg));
  }

  traverseForContrast(node, '#ffffff');

  if (lowContrastCount > 0) {
    const penalty = Math.min(20, lowContrastCount * 4);
    score -= penalty;
    issues.push({
      severity: lowContrastCount > 3 ? 'critical' : 'warning',
      category: 'accessibility',
      message: `${lowContrastCount} element(s) have insufficient color contrast (below WCAG AA)`,
      autoFixable: false,
    });
  }
  if (mediumContrastCount > 0) {
    const penalty = Math.min(10, mediumContrastCount * 2);
    score -= penalty;
    issues.push({
      severity: 'info',
      category: 'accessibility',
      message: `${mediumContrastCount} element(s) meet WCAG AA contrast but not AAA — consider improving for enhanced accessibility`,
      autoFixable: false,
    });
  }

  return { score: Math.max(0, score), issues };
}

// ============ POST Handler ============

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { designTree } = body;

    if (!designTree) {
      return NextResponse.json({ error: 'designTree is required' }, { status: 400 });
    }

    // Run all evaluations
    const completeness = evaluateCompleteness(designTree);
    const cssValid = evaluateCSS(designTree);
    const semantics = evaluateSemantics(designTree);
    const responsiveness = evaluateResponsiveness(designTree);
    const accessibility = evaluateAccessibility(designTree);

    // Combine all issues
    const allIssues = [
      ...completeness.issues,
      ...cssValid.issues,
      ...semantics.issues,
      ...responsiveness.issues,
      ...accessibility.issues,
    ].sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      completeness.score * 0.25 +
      cssValid.score * 0.2 +
      semantics.score * 0.2 +
      responsiveness.score * 0.2 +
      accessibility.score * 0.15
    );

    // Generate suggestions based on issues
    const suggestions: string[] = [];
    if (completeness.score < 70) suggestions.push('Add more content sections to make the design feel complete');
    if (cssValid.score < 70) suggestions.push('Fix CSS value issues — use real CSS values instead of Tailwind shorthand');
    if (semantics.score < 70) suggestions.push('Improve semantic HTML structure with proper tags');
    if (responsiveness.score < 70) suggestions.push('Use flexbox/grid layouts and relative units for better responsiveness');
    if (accessibility.score < 70) suggestions.push('Improve accessibility: add alt text, labels, and proper contrast');
    if (overallScore >= 80) suggestions.push('Great design! Consider fine-tuning spacing and typography for perfection');
    if (overallScore >= 90) suggestions.push('Excellent quality! Minor polish may enhance it further');

    const report: QualityReport = {
      overallScore,
      completeness: completeness.score,
      cssValid: cssValid.score,
      semantics: semantics.score,
      responsiveness: responsiveness.score,
      accessibility: accessibility.score,
      issues: allIssues,
      suggestions,
    };

    return NextResponse.json(report);
  } catch (error) {
    console.error('[Evaluate API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to evaluate design', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
