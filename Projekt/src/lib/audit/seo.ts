/**
 * Deterministic SEO audit + auto-fix for generated HTML artifacts.
 *
 * Part of the Audit Loop (A1-A2-A7): runs AFTER the Critique Theater's
 * ship_best, on the HTML string that is about to be persisted. Each check
 * either AUTO-FIXES the HTML in place (returns a mutated string + finding
 * with autoFixed:true) or reports a finding for the trace (autoFixed:false).
 *
 * Checks:
 *   - viewport-meta      : missing <meta name="viewport"> → inject it
 *   - description-meta   : missing <meta name="description"> → derive from <h1>
 *   - og-tags            : missing og:title/og:description → FLAG (P2, needs context)
 *   - lang-attr          : <html> without lang → set lang="de"
 *   - heading-order      : not exactly one <h1>, or <h3> before <h2> → FLAG (P1)
 *   - title-tag          : missing/empty <title> → derive from <h1>
 *   - structured-data    : no JSON-LD → FLAG (P2, advisory)
 *
 * Same greppy + cheap style as accessibility.ts: no DOM, no deps, deterministic.
 * Never throws — every check is defensive against malformed input.
 */

import type { AuditFinding } from './accessibility';

export type { AuditFinding, AuditSeverity } from './accessibility';

export interface SeoAuditResult {
  /** The HTML after all auto-fixes have been applied (unchanged if none). */
  html: string;
  /** Every finding from every check. */
  findings: AuditFinding[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

interface CheckCtx {
  findings: AuditFinding[];
}

/** Extract the text content of the first <h1> in the document, with tags
 *  stripped and whitespace collapsed. Empty string if none. Never throws. */
function firstH1Text(html: string): string {
  const m = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  if (!m || m[1] == null) return '';
  return m[1]
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape a string so it is safe to embed as an HTML attribute value. */
function escAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Inject a string immediately after the first <head ...> tag. Returns the
 *  new HTML, or null if no <head> exists. */
function injectAfterHead(html: string, snippet: string): string | null {
  const headRe = /<head\b[^>]*>/i;
  if (!headRe.test(html)) return null;
  return html.replace(headRe, `$&${snippet}`);
}

/** Truncate a description string to <= 155 chars on a word boundary. */
function clampDescription(s: string, max = 155): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

// ── Individual checks ──────────────────────────────────────────────────────

function checkViewportMeta(html: string, ctx: CheckCtx): string {
  if (/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    // Present and correct — no finding (avoid noise; a11y may report it too).
    return html;
  }
  const meta =
    '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const fixed = injectAfterHead(html, meta);
  if (fixed !== null) {
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-viewport',
      message: 'viewport-meta fehlt.',
      fix: '<meta name="viewport"> in <head> injiziert.',
      autoFixed: true,
    });
    return fixed;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'seo-viewport',
    message: 'viewport-meta fehlt, kein <head> gefunden.',
    fix: 'Manuell <meta name="viewport"> ergänzen.',
    autoFixed: false,
  });
  return html;
}

function checkDescriptionMeta(html: string, ctx: CheckCtx): string {
  // An existing description meta — even empty content — counts as present;
  // only a wholly missing tag triggers the fix.
  if (/<meta\b[^>]*name\s*=\s*["']description["']/i.test(html)) {
    return html;
  }
  const h1 = firstH1Text(html);
  if (!h1) {
    // Can't generate a good description without a heading — flag, don't guess.
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-description',
      message: 'description-meta fehlt und kein <h1> als Vorlage gefunden.',
      fix: 'Manuell eine aussagekräftige Meta-Description ergänzen.',
      autoFixed: false,
    });
    return html;
  }
  const desc = clampDescription(h1);
  const meta = `<meta name="description" content="${escAttr(desc)}">`;
  const fixed = injectAfterHead(html, meta);
  if (fixed !== null) {
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-description',
      message: 'description-meta fehlt.',
      fix: `Meta-Description aus <h1> generiert: „${desc}".`,
      autoFixed: true,
    });
    return fixed;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'seo-description',
    message: 'description-meta fehlt, kein <head> als Injektionsziel.',
    fix: 'Manuell eine Meta-Description ergänzen.',
    autoFixed: false,
  });
  return html;
}

function checkOgTags(html: string, ctx: CheckCtx): string {
  const hasOgTitle = /<meta\b[^>]*property\s*=\s*["']og:title["']/i.test(html);
  const hasOgDesc =
    /<meta\b[^>]*property\s*=\s*["']og:description["']/i.test(html);
  if (hasOgTitle && hasOgDesc) {
    return html;
  }
  // FLAG only — good OG copy needs brand/page context we don't have here.
  const missing = [
    !hasOgTitle && 'og:title',
    !hasOgDesc && 'og:description',
  ].filter(Boolean) as string[];
  ctx.findings.push({
    severity: 'P2',
    id: 'seo-og-tags',
    message: `Open-Graph-Tags fehlen: ${missing.join(', ')}.`,
    fix:
      'Manuell og-Tags mit Seitentitel und Beschreibung ergänzen (kontextabhängig).',
    autoFixed: false,
  });
  return html;
}

function checkLangAttr(html: string, ctx: CheckCtx): string {
  const htmlTagRe = /<html\b([^>]*)>/i;
  const m = htmlTagRe.exec(html);
  if (!m) {
    // No <html> tag at all — leave for structural audit; don't fabricate.
    return html;
  }
  const attrs = m[1] ?? '';
  if (/\blang\s*=/i.test(attrs)) {
    return html;
  }
  // AUTO-FIX: add lang="de" right after "<html".
  const fixed = html.replace(/<html\b/i, '<html lang="de"');
  ctx.findings.push({
    severity: 'P1',
    id: 'seo-lang',
    message: '<html> ohne lang-Attribut.',
    fix: 'lang="de" gesetzt.',
    autoFixed: true,
  });
  return fixed;
}

function checkHeadingOrder(html: string, ctx: CheckCtx): string {
  const problems: string[] = [];

  // Exactly one <h1>.
  const h1Count = (html.match(/<h1\b/gi) ?? []).length;
  if (h1Count === 0) {
    problems.push('kein <h1>');
  } else if (h1Count > 1) {
    problems.push(`${h1Count}× <h1>`);
  }

  // No <h3> should appear before the first <h2> (skipped-level ordering).
  // Find the index of the first <h2> and the first <h3>; if <h3> comes first
  // and both exist, that's an ordering violation.
  const h2m = /<h2\b/gi.exec(html);
  const h3m = /<h3\b/gi.exec(html);
  if (h2m && h3m && h3m.index < h2m.index) {
    problems.push('<h3> vor <h2>');
  }

  if (problems.length === 0) {
    return html;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'seo-heading-order',
    message: `Heading-Reihenfolge problematisch: ${problems.join(', ')}.`,
    fix:
      'Manuell korrigieren: genau ein <h1> als Seiten-Hauptüberschrift, dann <h2> vor <h3>.',
    autoFixed: false,
  });
  return html;
}

function checkTitleTag(html: string, ctx: CheckCtx): string {
  // Existing non-empty <title>?
  const titleRe = /<title\b[^>]*>([\s\S]*?)<\/title>/i;
  const m = titleRe.exec(html);
  if (m && (m[1] ?? '').replace(/<[^>]+>/g, '').trim() !== '') {
    return html;
  }
  const h1 = firstH1Text(html);
  if (!h1) {
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-title',
      message: '<title> fehlt oder ist leer, kein <h1> als Vorlage gefunden.',
      fix: 'Manuell einen aussagekräftigen <title> ergänzen.',
      autoFixed: false,
    });
    return html;
  }
  const titleText = clampDescription(h1, 60);
  const titleEl = `<title>${escAttr(titleText)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')}</title>`;
  if (m) {
    // Empty <title></title> — replace in place.
    const fixed = html.replace(titleRe, titleEl);
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-title',
      message: '<title> war leer.',
      fix: `<title> aus <h1> generiert: „${titleText}".`,
      autoFixed: true,
    });
    return fixed;
  }
  // No <title> at all — inject into <head>.
  const fixed = injectAfterHead(html, titleEl);
  if (fixed !== null) {
    ctx.findings.push({
      severity: 'P1',
      id: 'seo-title',
      message: '<title> fehlt.',
      fix: `<title> aus <h1> generiert: „${titleText}".`,
      autoFixed: true,
    });
    return fixed;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'seo-title',
    message: '<title> fehlt, kein <head> als Injektionsziel.',
    fix: 'Manuell einen <title> ergänzen.',
    autoFixed: false,
  });
  return html;
}

function checkStructuredData(html: string, ctx: CheckCtx): string {
  // JSON-LD block, or common microdata itemtype — either counts.
  const hasJsonLd =
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["']/i.test(html);
  const hasMicrodata = /\bitemtype\s*=/i.test(html);
  if (hasJsonLd || hasMicrodata) {
    return html;
  }
  ctx.findings.push({
    severity: 'P2',
    id: 'seo-structured-data',
    message: 'Keine strukturierten Daten (JSON-LD / Microdata) gefunden.',
    fix:
      'Manuell einen JSON-LD-Block (z. B. Organization, Article, BreadcrumbList) ergänzen.',
    autoFixed: false,
  });
  return html;
}

// ── Public entry ───────────────────────────────────────────────────────────

/**
 * Run all SEO checks on an HTML string. Auto-fixable checks mutate the HTML
 * in sequence; the returned `html` is the fully-fixed document (unchanged if
 * no auto-fix applied). `findings` records the flagged checks so the agent
 * trace can show the full audit. Never throws.
 */
export function auditSEO(html: string): SeoAuditResult {
  const ctx: CheckCtx = { findings: [] };
  let out = html;

  out = checkViewportMeta(out, ctx);
  out = checkDescriptionMeta(out, ctx);
  out = checkOgTags(out, ctx);
  out = checkLangAttr(out, ctx);
  out = checkHeadingOrder(out, ctx);
  out = checkTitleTag(out, ctx);
  out = checkStructuredData(out, ctx);

  return { html: out, findings: ctx.findings };
}
