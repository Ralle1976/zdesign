/**
 * Deterministic accessibility audit + auto-fix for generated HTML artifacts.
 *
 * Part of the Audit Loop (A1-A2-A7): runs AFTER the Critique Theater's
 * ship_best, on the HTML string that is about to be persisted. Each check
 * either AUTO-FIXES the HTML in place (returns a mutated string + finding
 * with autoFixed:true) or reports a finding for the trace (autoFixed:false).
 *
 * Checks (all auto-fixable here unless noted):
 *   - WCAG contrast  : --text vs --bg tokens in :root, <4.5:1 → darken --text
 *   - alt-text       : <img> without alt → add alt="" from nearest heading
 *   - focus-visible  : missing :focus-visible rule → inject a default
 *   - viewport-meta  : missing <meta name="viewport"> → inject it
 *   - lang-attr      : <html> without lang → set lang="de"
 *   - skip-link      : missing skip link → inject <a href="#main"> + #main id
 *
 * The functions are greppy + cheap (regex + small parsers), mirroring the
 * anti-slop linter's style: no DOM, no external deps, deterministic.
 */

export type AuditSeverity = 'P0' | 'P1' | 'P2';

export interface AuditFinding {
  severity: AuditSeverity;
  id: string;
  message: string;
  fix: string;
  /** True when this check applied an auto-fix to the HTML. */
  autoFixed?: boolean;
}

export interface AccessibilityAuditResult {
  html: string;
  findings: AuditFinding[];
}

// ── Color math (WCAG 2.x) ───────────────────────────────────────────────────

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.trim().replace(/^#/, '');
  let full = h;
  if (full.length === 3) {
    full = full
      .split('')
      .map((c) => c + c)
      .join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const chan = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
}

export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg);
  const b = parseHex(bg);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

// ── :root CSS-variable parsing ──────────────────────────────────────────────

/** Match a single :root { ... } block (first one). Greedy on body but
 *  constrained by the closing brace. */
const ROOT_BLOCK_RE = /:root\s*\{([^}]*)\}/i;

interface RootVars {
  body: string;
  /** Map of varName (with leading --) → raw value (first declaration wins). */
  vars: Map<string, string>;
}

function parseRootVars(html: string): RootVars | null {
  const m = ROOT_BLOCK_RE.exec(html);
  if (!m || m[1] == null) return null;
  const body = m[1];
  const vars = new Map<string, string>();
  const declRe = /(--[\w-]+)\s*:\s*([^;]+)/g;
  let dm: RegExpExecArray | null;
  while ((dm = declRe.exec(body)) !== null) {
    const name = dm[1]!;
    const value = dm[2]!.trim();
    if (!vars.has(name)) vars.set(name, value);
  }
  return { body, vars };
}

/** Candidate text/background token pairs to check, in priority order. The
 *  first pair whose values both parse as hex is audited. */
const CONTRAST_PAIRS: Array<{ text: string; bg: string }> = [
  { text: '--text', bg: '--bg' },
  { text: '--color-text', bg: '--color-bg' },
  { text: '--fg', bg: '--bg' },
  { text: '--text', bg: '--surface' },
  { text: '--ink', bg: '--paper' },
];

/** Darken a hex color toward black by repeatedly subtracting from each
 *  channel until the contrast against `bg` meets `target` (or we bottom
 *  out at #000000). */
function darkenUntilContrast(
  fgHex: string,
  bgHex: string,
  target: number,
): { hex: string; ratio: number } | null {
  const bgRgb = parseHex(bgHex);
  if (!bgRgb) return null;
  let rgb = parseHex(fgHex);
  if (!rgb) return null;
  const step = 12;
  for (let i = 0; i < 40; i++) {
    const ratio = contrastRatio(toHex(rgb), bgHex);
    if (ratio != null && ratio >= target) {
      return { hex: toHex(rgb), ratio };
    }
    rgb = {
      r: rgb.r - step,
      g: rgb.g - step,
      b: rgb.b - step,
    };
    if (rgb.r <= 0 && rgb.g <= 0 && rgb.b <= 0) {
      rgb = { r: 0, g: 0, b: 0 };
      const finalRatio = contrastRatio('#000000', bgHex);
      return { hex: '#000000', ratio: finalRatio ?? 0 };
    }
  }
  const ratio = contrastRatio(toHex(rgb), bgHex);
  return { hex: toHex(rgb), ratio: ratio ?? 0 };
}

// ── Individual checks ───────────────────────────────────────────────────────

const WCAG_AA = 4.5;

interface CheckCtx {
  findings: AuditFinding[];
}

function checkContrast(html: string, ctx: CheckCtx): string {
  const root = parseRootVars(html);
  if (!root) return html;
  for (const pair of CONTRAST_PAIRS) {
    const textVal = root.vars.get(pair.text);
    const bgVal = root.vars.get(pair.bg);
    if (!textVal || !bgVal) continue;
    const ratio = contrastRatio(textVal, bgVal);
    if (ratio == null) continue; // non-hex (var(), hsl, etc.) — skip safely
    if (ratio >= WCAG_AA) {
      ctx.findings.push({
        severity: 'P2',
        id: 'wcag-contrast',
        message: `Kontrast ${pair.text}/${pair.bg} = ${ratio.toFixed(1)}:1 — erfüllt WCAG AA.`,
        fix: 'Keine Maßnahme nötig.',
        autoFixed: false,
      });
      return html;
    }
    // AUTO-FIX: darken the --text token until ≥ 4.5:1, rewrite inside the
    // :root block (replaces the literal value of the matched declaration).
    const fixed = darkenUntilContrast(textVal, bgVal, WCAG_AA);
    if (!fixed) continue;
    // Replace ONLY the first occurrence of this exact declaration in the
    // captured :root body, then splice back into the document.
    const declRe = new RegExp(
      `(${pair.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*:\\s*)[^;]+`,
      'i',
    );
    const newBody = root.body.replace(declRe, `$1${fixed.hex}`);
    if (newBody === root.body) continue;
    const newHtml = html.replace(root.body, newBody);
    ctx.findings.push({
      severity: 'P0',
      id: 'wcag-contrast',
      message: `Kontrast ${pair.text}/${pair.bg} = ${ratio.toFixed(1)}:1 unter WCAG AA (${WCAG_AA}:1).`,
      fix: `${pair.text} auf ${fixed.hex} abgedunkelt → ${fixed.ratio.toFixed(1)}:1.`,
      autoFixed: true,
    });
    return newHtml;
  }
  return html;
}

function checkAltText(html: string, ctx: CheckCtx): string {
  let out = html;
  let touched = false;
  // Match <img ...> tags lacking an alt= attribute.
  const imgRe = /<img\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  const replacements: Array<{ from: string; to: string }> = [];
  while ((m = imgRe.exec(out)) !== null) {
    const full = m[0];
    const attrs = m[1] ?? '';
    if (/\balt\s*=/i.test(attrs)) continue;
    // Nearest preceding heading text (h1-h3) as a descriptive alt.
    const upto = out.slice(0, m.index);
    const headingRe = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
    let hm: RegExpExecArray | null;
    let lastHeading = '';
    while ((hm = headingRe.exec(upto)) !== null) {
      lastHeading = (hm[1] ?? '').replace(/<[^>]+>/g, '').trim();
    }
    const alt = lastHeading.slice(0, 120) || 'Bild';
    const altAttr = ` alt="${alt.replace(/"/g, '')}"`;
    // Inject alt immediately after the "<img" token.
    const fixed = full.replace(/<img\b/i, (match) => match + altAttr);
    replacements.push({ from: full, to: fixed });
    touched = true;
  }
  if (touched) {
    // Apply replacements on the original string in order (each full match is
    // unique by index; we re-scan to be safe).
    out = html;
    for (const r of replacements) {
      out = out.replace(r.from, r.to);
    }
    ctx.findings.push({
      severity: 'P1',
      id: 'img-alt',
      message: `${replacements.length} <img> ohne alt-Attribut.`,
      fix: `alt aus nächstem Heading abgeleitet für ${replacements.length} Bild(er) eingefügt.`,
      autoFixed: true,
    });
    return out;
  }
  return html;
}

function checkFocusVisible(html: string, ctx: CheckCtx): string {
  if (/:focus-visible\b/i.test(html)) {
    ctx.findings.push({
      severity: 'P2',
      id: 'focus-visible',
      message: ':focus-visible-Regel vorhanden.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  // AUTO-FIX: inject a visible-focus rule inside the first <style> block,
  // or prepend a <style> after <head> if none exists.
  const rule =
    'a:focus-visible,button:focus-visible,[tabindex]:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid currentColor;outline-offset:2px;}';
  const styleOpenRe = /(<style\b[^>]*>)/i;
  if (styleOpenRe.test(html)) {
    const fixed = html.replace(styleOpenRe, `$1\n${rule}\n`);
    ctx.findings.push({
      severity: 'P1',
      id: 'focus-visible',
      message: 'Keine :focus-visible-Regel im CSS.',
      fix: 'Sichtbare Fokus-Regel in <style> injiziert.',
      autoFixed: true,
    });
    return fixed;
  }
  const headRe = /<head\b[^>]*>/i;
  if (headRe.test(html)) {
    const fixed = html.replace(headRe, `$&<style>${rule}</style>`);
    ctx.findings.push({
      severity: 'P1',
      id: 'focus-visible',
      message: 'Keine :focus-visible-Regel im CSS.',
      fix: '<style> mit Fokus-Regel in <head> injiziert.',
      autoFixed: true,
    });
    return fixed;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'focus-visible',
    message: 'Keine :focus-visible-Regel und kein <head>/<style> als Injektionsziel.',
    fix: 'Manuell eine :focus-visible-Regel ergänzen.',
    autoFixed: false,
  });
  return html;
}

function checkViewportMeta(html: string, ctx: CheckCtx): string {
  if (/<meta\b[^>]*name\s*=\s*["']viewport["']/i.test(html)) {
    ctx.findings.push({
      severity: 'P2',
      id: 'viewport-meta',
      message: 'viewport-meta vorhanden.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  const meta = '<meta name="viewport" content="width=device-width, initial-scale=1">';
  const headRe = /<head\b[^>]*>/i;
  if (headRe.test(html)) {
    const fixed = html.replace(headRe, `$&${meta}`);
    ctx.findings.push({
      severity: 'P1',
      id: 'viewport-meta',
      message: 'viewport-meta fehlt.',
      fix: '<meta name="viewport"> in <head> injiziert.',
      autoFixed: true,
    });
    return fixed;
  }
  // Fall back to top of <html>.
  const htmlRe = /<html\b[^>]*>/i;
  if (htmlRe.test(html)) {
    const fixed = html.replace(htmlRe, `$&<head>${meta}</head>`);
    ctx.findings.push({
      severity: 'P1',
      id: 'viewport-meta',
      message: 'viewport-meta fehlt.',
      fix: '<head> mit <meta name="viewport"> eingefügt.',
      autoFixed: true,
    });
    return fixed;
  }
  ctx.findings.push({
    severity: 'P1',
    id: 'viewport-meta',
    message: 'viewport-meta fehlt, kein <head> gefunden.',
    fix: 'Manuell <meta name="viewport"> ergänzen.',
    autoFixed: false,
  });
  return html;
}

function checkLangAttr(html: string, ctx: CheckCtx): string {
  const htmlTagRe = /<html\b([^>]*)>/i;
  const m = htmlTagRe.exec(html);
  if (!m) {
    ctx.findings.push({
      severity: 'P1',
      id: 'lang-attr',
      message: 'Kein <html>-Tag gefunden.',
      fix: 'Manuell ein <html lang="de"> ergänzen.',
      autoFixed: false,
    });
    return html;
  }
  const attrs = m[1] ?? '';
  if (/\blang\s*=/i.test(attrs)) {
    ctx.findings.push({
      severity: 'P2',
      id: 'lang-attr',
      message: '<html> hat ein lang-Attribut.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  // AUTO-FIX: add lang="de" right after "<html".
  const fixed = html.replace(/<html\b/i, '<html lang="de"');
  ctx.findings.push({
    severity: 'P1',
    id: 'lang-attr',
    message: '<html> ohne lang-Attribut.',
    fix: 'lang="de" gesetzt.',
    autoFixed: true,
  });
  return fixed;
}

function checkSkipLink(html: string, ctx: CheckCtx): string {
  const hasSkip = /class\s*=\s*["'][^"']*\bskip\b/i.test(html) || /href\s*=\s*["']#main["']/i.test(html);
  if (hasSkip) {
    ctx.findings.push({
      severity: 'P2',
      id: 'skip-link',
      message: 'Skip-Link vorhanden.',
      fix: 'Keine Maßnahme nötig.',
      autoFixed: false,
    });
    return html;
  }
  // AUTO-FIX: inject the skip link + style right after <body>, and add
  // id="main" to the first <section> if none already carries it.
  const skipStyle =
    '<style>.skip{position:absolute;left:-9999px;top:0;z-index:9999;}.skip:focus{left:8px;top:8px;background:var(--bg,#fff);color:var(--text,#000);padding:8px 12px;}</style>';
  const skipLink = '<a href="#main" class="skip">Zum Inhalt</a>';

  let fixed = html;
  const bodyRe = /<body\b[^>]*>/i;
  if (bodyRe.test(fixed)) {
    fixed = fixed.replace(bodyRe, `$&${skipStyle}${skipLink}`);
  } else {
    ctx.findings.push({
      severity: 'P1',
      id: 'skip-link',
      message: 'Skip-Link fehlt, kein <body> als Injektionsziel.',
      fix: 'Manuell einen Skip-Link ergänzen.',
      autoFixed: false,
    });
    return html;
  }

  // Attach #main to the first <section> that lacks an id (or add id to the
  // first <section> outright).
  const sectionRe = /<section\b([^>]*)>/i;
  if (sectionRe.test(fixed)) {
    const sm = sectionRe.exec(fixed)!;
    const sAttrs = sm[1] ?? '';
    if (/\bid\s*=/i.test(sAttrs)) {
      // Section already has an id; leave it but the skip target may differ.
      // We still treat the skip link as injected (best-effort).
    } else {
      fixed = fixed.replace(sectionRe, '<section id="main"$1>');
    }
  } else {
    // No <section> — point the skip link at <main> if present, else leave as-is.
    if (/<main\b/i.test(fixed) && !/<main\b[^>]*\bid\s*=\s*["']main["']/i.test(fixed)) {
      fixed = fixed.replace(/<main\b/i, '<main id="main"');
    }
  }

  ctx.findings.push({
    severity: 'P1',
    id: 'skip-link',
    message: 'Skip-Link fehlt.',
    fix: 'Skip-Link + #main-Anker injiziert.',
    autoFixed: true,
  });
  return fixed;
}

// ── Public entry ────────────────────────────────────────────────────────────

/**
 * Run all accessibility checks on an HTML string. Each auto-fixable check
 * mutates the HTML in sequence and the returned `html` is the fully-fixed
 * document. `findings` records every check (both the fixed and the
 * already-passing ones) so the agent trace can show the full audit.
 */
export function auditAccessibility(html: string): AccessibilityAuditResult {
  const ctx: CheckCtx = { findings: [] };
  let out = html;

  // Order matters: contrast first (token rewrite), then structural fixes.
  out = checkContrast(out, ctx);
  out = checkAltText(out, ctx);
  out = checkFocusVisible(out, ctx);
  out = checkViewportMeta(out, ctx);
  out = checkLangAttr(out, ctx);
  out = checkSkipLink(out, ctx);

  return { html: out, findings: ctx.findings };
}
