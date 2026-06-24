/**
 * Design-Rhythm audit (A5) — deterministic FLAGS on generated HTML.
 *
 * Part of the Audit Loop (A1-A2-A7): runs AFTER the Critique Theater's
 * ship_best, on the HTML string that is about to be persisted. Unlike the
 * accessibility audit, these checks NEVER auto-fix — they flag violations
 * that need design judgment (a human or the refine loop decides the right
 * scale/grid). They return AuditFinding[] with autoFixed:false only.
 *
 * Checks (all flags, no mutation):
 *   - 8px-grid            : padding/margin values off the 4px/8px grid
 *   - border-radius scale : >3 distinct border-radius values
 *   - font-size scale     : >8 distinct font-size values
 *   - line-height         : body line-height < 1.4
 *
 * The functions are greppy + cheap (regex), mirroring the anti-slop linter's
 * style: no DOM, no external deps, deterministic. Never throws.
 */

import type { AuditFinding } from './accessibility';

export type { AuditFinding } from './accessibility';

// ── Value extraction ────────────────────────────────────────────────────────

/** Extract every numeric length value declared for the given CSS properties
 *  across inline `style="..."` attributes AND <style> blocks. Returns the raw
 *  px numbers (only `px` units are grid-relevant here; rem/em/half-pixels are
 *  ignored for grid math). */
function extractLengthValues(
  html: string,
  property: string,
): number[] {
  const values: number[] = [];
  // Match `prop: <number>px` case-insensitively, with optional whitespace.
  // Catches both inline style="" and CSS inside <style> blocks.
  const prop = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${prop}\\s*:\\s*([0-9]+(?:\\.[0-9]+)?)px`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const n = parseFloat(m[1]!);
    if (Number.isFinite(n)) values.push(n);
  }
  return values;
}

/** Extract the distinct set of raw property values (the part after the colon,
 *  trimmed, with the trailing `;`/quote removed) for a given CSS property.
 *  Used for radius/font-size cardinality checks where we want literal values
 *  like "8px", "1.5rem", "50%". */
function extractDistinctValues(html: string, property: string): Set<string> {
  const out = new Set<string>();
  const prop = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match `prop: <value>` where value runs up to `;`, `"`, or newline.
  const re = new RegExp(`${prop}\\s*:\\s*([^;"'\\n]+)`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = (m[1] ?? '').trim();
    if (raw.length > 0) out.add(raw);
  }
  return out;
}

// ── Individual checks ───────────────────────────────────────────────────────

/** A value is on-grid when it is a multiple of 4. Larger values (>=16px) are
 *  expected to land on the 8px grid. We collect only the offenders so the
 *  finding can name them. */
function offGridValues(nums: number[]): number[] {
  const offenders: number[] = [];
  for (const n of nums) {
    const rounded = Math.round(n);
    if (rounded !== n) {
      // Half-pixel-ish values are inherently off-grid.
      offenders.push(n);
      continue;
    }
    const isMult4 = rounded % 4 === 0;
    const isMult8 = rounded % 8 === 0;
    if (rounded >= 16) {
      if (!isMult8) offenders.push(n);
    } else {
      if (!isMult4) offenders.push(n);
    }
  }
  return offenders;
}

function uniqueSorted(nums: number[]): number[] {
  return Array.from(new Set(nums)).sort((a, b) => a - b);
}

function check8pxGrid(html: string, findings: AuditFinding[]): void {
  const paddings = extractLengthValues(html, 'padding');
  const margins = extractLengthValues(html, 'margin');
  // Also catch `padding-top`, `margin-left`, etc. via the base word match —
  // extractLengthValues already greps any `padding...: Npx` because the regex
  // is `padding\s*:`, which does NOT match `padding-top:`. Re-run per side.
  const sides = ['-top', '-right', '-bottom', '-left'];
  for (const base of ['padding', 'margin']) {
    for (const s of sides) {
      const more = extractLengthValues(html, `${base}${s}`);
      for (const v of more) (base === 'padding' ? paddings : margins).push(v);
    }
  }

  const offP = offGridValues(paddings);
  const offM = offGridValues(margins);
  const off = uniqueSorted([...offP, ...offM]);

  if (off.length > 0) {
    const sample = off.slice(0, 6).map((n) => `${n}px`).join(', ');
    const more = off.length > 6 ? ` (+${off.length - 6} weitere)` : '';
    findings.push({
      severity: 'P2',
      id: '8px-grid',
      message: `Wert ${sample}${more} ist nicht im 8px-Raster.`,
      fix: 'Alle padding-/margin-Werte auf ein 4px/8px-Raster (≥16px auf 8px) ausrichten.',
      autoFixed: false,
    });
  }
}

function checkBorderRadiusScale(html: string, findings: AuditFinding[]): void {
  const values = extractDistinctValues(html, 'border-radius');
  // Also catch `border-top-left-radius` etc. via the `border-*-radius` family.
  const longhands = [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius',
  ];
  for (const lh of longhands) {
    for (const v of Array.from(extractDistinctValues(html, lh))) values.add(v);
  }
  if (values.size > 3) {
    const listed = Array.from(values).slice(0, 6).join(', ');
    const more = values.size > 6 ? ` (+${values.size - 6} weitere)` : '';
    findings.push({
      severity: 'P2',
      id: 'border-radius-scale',
      message: `${values.size} verschiedene border-radius Werte (${listed}${more}) — zu viele verschiedene border-radius Werte, konsolidieren.`,
      fix: 'Auf 1–3 Radius-Tokens festlegen (z. B. --radius-sm/md/lg) und konsistent anwenden.',
      autoFixed: false,
    });
  }
}

function checkFontSizeScale(html: string, findings: AuditFinding[]): void {
  const values = extractDistinctValues(html, 'font-size');
  if (values.size > 8) {
    const listed = Array.from(values).slice(0, 8).join(', ');
    const more = values.size > 8 ? ` (+${values.size - 8} weitere)` : '';
    findings.push({
      severity: 'P2',
      id: 'font-size-scale',
      message: `${values.size} verschiedene Schriftgrößen (${listed}${more}) — zu viele Schriftgrößen, Skala definieren.`,
      fix: 'Auf eine typografische Skala (z. B. 12/14/16/20/24/32/48px) reduzieren und als Tokens ablegen.',
      autoFixed: false,
    });
  }
}

function checkLineHeight(html: string, findings: AuditFinding[]): void {
  // Look at the `body { ... line-height: X }` rule specifically. If there's no
  // explicit body rule, fall back to any top-level `line-height` declaration.
  const bodyRe = /body\s*\{([^}]*)\}/i;
  let lhRaw: string | null = null;
  const bodyMatch = bodyRe.exec(html);
  if (bodyMatch && bodyMatch[1] != null) {
    const lh = /line-height\s*:\s*([^;"'}]+)/i.exec(bodyMatch[1]);
    if (lh && lh[1] != null) lhRaw = lh[1].trim();
  }
  if (lhRaw == null) {
    // Fallback: first line-height declaration anywhere in the document.
    const any = /line-height\s*:\s*([^;"'}]+)/i.exec(html);
    if (any && any[1] != null) lhRaw = any[1].trim();
  }
  if (lhRaw == null) return; // nothing to audit

  // Accept unitless (e.g. `1.4`) or px (`22px`). Percentages/`em` are skipped.
  let value: number | null = null;
  const unitless = parseFloat(lhRaw);
  if (/^[0-9.]+$/.test(lhRaw) && Number.isFinite(unitless)) {
    value = unitless;
  } else if (/px/i.test(lhRaw)) {
    const px = parseFloat(lhRaw);
    // For px line-heights we cannot judge readability directly; convert to an
    // approximate ratio only when a body font-size is known. Skip otherwise.
    const fsMatch = /font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)px/i.exec(
      bodyMatch?.[1] ?? html,
    );
    if (fsMatch && fsMatch[1] != null && Number.isFinite(px)) {
      const fs = parseFloat(fsMatch[1]);
      if (fs > 0) value = px / fs;
    }
  }

  if (value != null && value < 1.4) {
    findings.push({
      severity: 'P1',
      id: 'line-height',
      message: `line-height ${lhRaw} zu gering für Lesbarkeit (≈${value.toFixed(2)} < 1.4).`,
      fix: 'body line-height auf mindestens 1.5 (oder 1.4 für UI-Dichte) setzen.',
      autoFixed: false,
    });
  }
}

// ── Public entry ────────────────────────────────────────────────────────────

/**
 * Run all design-rhythm checks on an HTML string. Returns findings only —
 * the HTML is NEVER modified (these are FLAGS for the refine loop, not
 * auto-fixes). Wrapped in try/catch at the top level so a parser hiccup can
 * never break the audit pipeline.
 */
export function auditDesignRhythm(html: string): AuditFinding[] {
  try {
    const findings: AuditFinding[] = [];
    check8pxGrid(html, findings);
    checkBorderRadiusScale(html, findings);
    checkFontSizeScale(html, findings);
    checkLineHeight(html, findings);
    return findings;
  } catch {
    // Never throws — a malformed document is a no-op, not a crash.
    return [];
  }
}
