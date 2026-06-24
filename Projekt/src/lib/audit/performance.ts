/**
 * Deterministic performance audit + auto-fix for generated HTML artifacts.
 *
 * Part of the Audit Loop (A1-A2-A7): runs AFTER the accessibility audit on
 * the HTML string that is about to be persisted. Each check either
 * AUTO-FIXES the HTML in place (returns a mutated string + finding with
 * autoFixed:true) or reports a finding for the trace (autoFixed:false).
 *
 * Checks:
 *   - css-size       : inline <style> content > 50KB → FLAG (P1)
 *   - font-display   : Google Fonts <link> without display=swap → AUTO-FIX
 *   - render-blocking: <link rel="stylesheet"> to external CSS → FLAG (P2)
 *   - img-lazy       : <img> without loading="lazy" (except first) → AUTO-FIX
 *   - img-dimensions : <img> without width/height → FLAG (P2, CLS)
 *   - script-defer   : inline <script> without defer → FLAG (P2, advisory)
 *
 * Same style as accessibility.ts: greppy + cheap (regex), no DOM, no external
 * deps, deterministic, never throws.
 */

import type { AuditFinding } from './accessibility';

export type { AuditFinding, AuditSeverity } from './accessibility';

export interface PerformanceAuditResult {
  html: string;
  findings: AuditFinding[];
}

// ── Shared context (mirrors accessibility.ts) ───────────────────────────────

interface CheckCtx {
  findings: AuditFinding[];
}

/** Threshold for flagging oversized inline CSS (50KB). */
const CSS_SIZE_LIMIT = 50 * 1024;

// ── Individual checks ───────────────────────────────────────────────────────

/** Inline <style> content > 50KB → FLAG (P1). Not auto-fixable here —
 *  deduplication/minification is a refine-loop concern. */
function checkCssSize(html: string, ctx: CheckCtx): string {
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = styleRe.exec(html)) !== null) {
    total += (m[1] ?? '').length;
  }
  if (total === 0) return html; // nothing inline — nothing to flag
  if (total <= CSS_SIZE_LIMIT) {
    ctx.findings.push({
      severity: 'P2',
      id: 'css-size',
      message: `Inline-CSS ${(total / 1024).toFixed(1)}KB — unter Grenze (${CSS_SIZE_LIMIT / 1024}KB).`,
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'css-size',
    message: `Inline-CSS ${(total / 1024).toFixed(1)}KB überschreitet Grenze (${CSS_SIZE_LIMIT / 1024}KB).`,
    fix: 'CSS verdichten (Regeln deduplizieren, ungenutzte Selektoren entfernen).',
    autoFixed: false,
  });
  return html;
}

/** Google Fonts <link> without display=swap → AUTO-FIX append &display=swap. */
function checkFontDisplay(html: string, ctx: CheckCtx): string {
  // Google Fonts stylesheet links: href contains fonts.googleapis.com.
  const linkRe = /<link\b([^>]*\bhref\s*=\s*["']https?:\/\/fonts\.googleapis\.com[^"']*["'][^>]*)>/gi;
  const replacements: Array<{ from: string; to: string }> = [];
  let m: RegExpExecArray | null;
  let touched = false;
  while ((m = linkRe.exec(html)) !== null) {
    const full = m[0];
    const attrs = m[1] ?? '';
    // Already has display=swap on the href? skip.
    if (/display\s*=\s*swap/i.test(attrs)) continue;
    // Append display=swap to the href URL (with & if query already present,
    // with ? otherwise).
    const hrefRe = /(href\s*=\s*["'])(https?:\/\/fonts\.googleapis\.com[^"']*)(["'])/i;
    const fixed = full.replace(hrefRe, (_match, pre: string, url: string, post: string) => {
      const sep = url.includes('?') ? '&' : '?';
      return `${pre}${url}${sep}display=swap${post}`;
    });
    if (fixed !== full) {
      replacements.push({ from: full, to: fixed });
      touched = true;
    }
  }
  if (!touched) return html;
  let out = html;
  for (const r of replacements) {
    out = out.replace(r.from, r.to);
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'font-display',
    message: `${replacements.length} Google-Fonts-<link> ohne display=swap.`,
    fix: `&display=swap an ${replacements.length} Link(s) angehängt.`,
    autoFixed: true,
  });
  return out;
}

/** <link rel="stylesheet"> to external CSS (not inline) → FLAG (P2). */
function checkRenderBlockingCss(html: string, ctx: CheckCtx): string {
  // External stylesheet links: rel="stylesheet" with an http(s) href.
  const linkRe = /<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi;
  const matches = html.match(linkRe);
  const count = matches ? matches.length : 0;
  if (count === 0) {
    ctx.findings.push({
      severity: 'P2',
      id: 'render-blocking-css',
      message: 'Keine externen render-blockierenden Stylesheets.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  ctx.findings.push({
    severity: 'P2',
    id: 'render-blocking-css',
    message: `${count} externes/<link> CSS blockiert Rendering.`,
    fix: 'Kritisches CSS inline einbetten oder preload-Strategie verwenden.',
    autoFixed: false,
  });
  return html;
}

/** <img> without loading="lazy" (except the first) → AUTO-FIX add
 *  loading="lazy" to all but the first <img>. */
function checkImgLazy(html: string, ctx: CheckCtx): string {
  const imgRe = /<img\b([^>]*)>/gi;
  const indices: Array<{ match: string; attrs: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    indices.push({ match: m[0], attrs: m[1] ?? '', index: m.index });
  }
  if (indices.length <= 1) return html; // 0 or 1 image — nothing to lazy-load
  const replacements: Array<{ from: string; to: string }> = [];
  // Skip the first image (above-fold), process the rest.
  for (let i = 1; i < indices.length; i++) {
    const { match, attrs } = indices[i]!;
    if (/\bloading\s*=/i.test(attrs)) continue; // already has a loading attr
    const fixed = match.replace(/<img\b/i, '<img loading="lazy"');
    if (fixed !== match) {
      replacements.push({ from: match, to: fixed });
    }
  }
  if (replacements.length === 0) return html;
  let out = html;
  for (const r of replacements) {
    out = out.replace(r.from, r.to);
  }
  ctx.findings.push({
    severity: 'P2',
    id: 'img-lazy',
    message: `${replacements.length} <img> ohne loading="lazy" (unterhalb Falz).`,
    fix: `loading="lazy" an ${replacements.length} Bild(er) gesetzt.`,
    autoFixed: true,
  });
  return out;
}

/** <img> without width/height → FLAG (P2, CLS). */
function checkImgDimensions(html: string, ctx: CheckCtx): string {
  const imgRe = /<img\b([^>]*)>/gi;
  let missing = 0;
  let total = 0;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(html)) !== null) {
    total += 1;
    const attrs = m[1] ?? '';
    const hasWidth = /\bwidth\s*=/i.test(attrs);
    const hasHeight = /\bheight\s*=/i.test(attrs);
    if (!hasWidth || !hasHeight) missing += 1;
  }
  if (total === 0) return html; // no images — nothing to report
  if (missing === 0) {
    ctx.findings.push({
      severity: 'P2',
      id: 'img-dimensions',
      message: 'Alle <img> haben width/height.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  ctx.findings.push({
    severity: 'P2',
    id: 'img-dimensions',
    message: `${missing} <img> fehlt width/height → CLS-Risiko.`,
    fix: 'width/height setzen oder aspect-ratio vorgeben.',
    autoFixed: false,
  });
  return html;
}

/** Inline <script> without defer → FLAG (P2, advisory). Only flags inline
 *  scripts (has body content); external src= scripts are left to the
 *  caller's strategy. */
function checkScriptDefer(html: string, ctx: CheckCtx): string {
  // Inline scripts: <script ...>BODY</script> where BODY is non-empty and the
  // opening tag has no src=.
  const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let flagged = 0;
  let sawInline = false;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    // Skip external scripts (src=).
    if (/\bsrc\s*=/i.test(attrs)) continue;
    // Skip empty/whitespace-only inline scripts.
    if (body.trim().length === 0) continue;
    sawInline = true;
    if (/\bdefer\b/i.test(attrs)) continue;
    flagged += 1;
  }
  if (!sawInline) return html;
  if (flagged === 0) {
    ctx.findings.push({
      severity: 'P2',
      id: 'script-defer',
      message: 'Inline-<script> haben defer.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  ctx.findings.push({
    severity: 'P2',
    id: 'script-defer',
    message: `${flagged} Inline-<script> ohne defer.`,
    fix: 'defer hinzufügen oder Script ans Dokumentende verschieben (advisory).',
    autoFixed: false,
  });
  return html;
}

// ── Public entry ────────────────────────────────────────────────────────────

/**
 * Run all performance checks on an HTML string. Each auto-fixable check
 * mutates the HTML in sequence and the returned `html` is the fully-fixed
 * document. `findings` records every check (both the fixed and the
 * already-passing ones) so the agent trace can show the full audit.
 *
 * Never throws — returns the original HTML on any internal error.
 */
export function auditPerformance(inputHtml: string): PerformanceAuditResult {
  try {
    const ctx: CheckCtx = { findings: [] };
    let out = inputHtml;

    out = checkCssSize(out, ctx);
    out = checkFontDisplay(out, ctx);
    out = checkRenderBlockingCss(out, ctx);
    out = checkImgLazy(out, ctx);
    out = checkImgDimensions(out, ctx);
    out = checkScriptDefer(out, ctx);

    return { html: out, findings: ctx.findings };
  } catch {
    // Never throw — the audit loop must not break generation.
    return { html: inputHtml, findings: [] };
  }
}
