/**
 * Deterministic anti-slop linter for generated HTML artifacts.
 *
 * Ported faithfully from OpenDesign's apps/daemon/src/lint-artifact.ts
 * (Apache-2.0). Runs grep-style checks against an artifact body and
 * returns structured findings. P0 = the 7 cardinal sins (must-fix AI
 * tells); P1 = soft tells (should fix).
 *
 * The linter is deliberately greppy: cheap, deterministic, no HTML
 * parser. Each finding carries a snippet so the agent can verify. We
 * strip HTML comments and token-definition blocks first to avoid false
 * positives on intentional design-system declarations.
 */

export type LintSeverity = 'P0' | 'P1' | 'P2';

export interface LintFinding {
  severity: LintSeverity;
  id: string;
  message: string;
  fix: string;
  snippet?: string;
}

// ── Cardinal-sin palettes (verbatim from OpenDesign) ────────────────────────

const PURPLE_HEXES = [
  '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#581c87',
  '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe',
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3', '#312e81',
  '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff', '#eef2ff',
];

const TRUST_GRADIENT_BLUE_HEXES = [
  '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  '#60a5fa', '#93c5fd', '#bfdbfe',
  '#0ea5e9', '#0284c7', '#0369a1', '#38bdf8', '#7dd3fc',
];

const TRUST_GRADIENT_CYAN_HEXES = [
  '#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63',
  '#22d3ee', '#67e8f9', '#a5f3fc',
];

const AI_DEFAULT_INDIGO = [
  '#6366f1', '#4f46e5', '#4338ca', '#3730a3',
  '#8b5cf6', '#7c3aed', '#a855f7',
];

const SLOP_EMOJI = [
  '✨', '🚀', '🎯', '⚡', '🔥', '💡', '📈', '🎨', '🛡️', '🌟',
  '💪', '🎉', '👋', '🙌', '✅', '⭐', '🏆',
];

const INVENTED_METRIC_PATTERNS = [
  /\b10[×x]\s+(faster|better|easier)\b/i,
  /\b99\.\d+%\s+uptime\b/i,
  /\bzero[- ]downtime\b/i,
  /\b3[×x]\s+more\s+(productive|efficient)\b/i,
];

const FILLER_PATTERNS = [
  /\bfeature\s+(one|two|three|1|2|3)\b/i,
  /\blorem\s+ipsum\b/i,
  /\bdolor\s+sit\s+amet\b/i,
  /\bplaceholder\s+text\b/i,
  /\bsample\s+content\b/i,
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clip(s: string): string {
  if (!s) return '';
  const trimmed = s.replace(/\s+/g, ' ').trim();
  return trimmed.length > 200 ? trimmed.slice(0, 197) + '…' : trimmed;
}

// Remove CSS rule blocks that define design tokens globally (:root,
// [data-theme=...]). An intentional `--accent: #6366f1` in :root is the
// design system speaking and must not trip the indigo check, but a
// component-level literal still should. Runs inside <style> bodies.
const GLOBAL_THEME_ATTRIBUTES = new Set([
  'data-theme', 'data-color-scheme', 'data-mode',
]);

function isGlobalThemeScopeSelector(s: string): boolean {
  const tagAttr = /^(?::root|html|body)(?:\[([a-zA-Z-]+)(?:[*^$|~]?=[^\]]*)?\])?$/.exec(s);
  if (tagAttr) {
    const attrName = tagAttr[1];
    if (!attrName) return true;
    return GLOBAL_THEME_ATTRIBUTES.has(attrName.toLowerCase());
  }
  const bareAttr = /^\[([a-zA-Z-]+)(?:[*^$|~]?=[^\]]*)?\]$/.exec(s);
  const bareAttrName = bareAttr?.[1];
  if (bareAttrName && GLOBAL_THEME_ATTRIBUTES.has(bareAttrName.toLowerCase())) return true;
  return false;
}

function isTokenShapedDeclaration(decl: string): boolean {
  if (/^--[\w-]+\s*:/.test(decl)) return true;
  if (/^color-scheme\s*:/i.test(decl)) return true;
  return false;
}

function declarationLaundersIndigo(decl: string): boolean {
  const m = /^(--[\w-]+)\s*:\s*(.+)$/.exec(decl);
  if (!m || m[1] == null || m[2] == null) return false;
  if (m[1].toLowerCase() === '--accent') return false;
  const value = m[2].toLowerCase();
  return AI_DEFAULT_INDIGO.some((hex) => value.includes(hex.toLowerCase()));
}

function stripTokenBlocks(input: string): string {
  return input.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_full, open: string, css: string, close: string) =>
      `${open}${stripTokenBlocksFromCss(css)}${close}`,
  );
}

function stripTokenBlocksFromCss(css: string): string {
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, '');
  return cleaned.replace(
    /([^{}]*)\{([^{}]*)\}/g,
    (full: string, selector: string, body: string) => {
      const sel = (selector || '').trim();
      if (!sel.split(',').map((x) => x.trim()).filter(Boolean).every(isGlobalThemeScopeSelector)) return full;
      const decls = (body || '').split(';').map((d) => d.trim()).filter(Boolean);
      if (decls.length === 0) return full;
      if (!decls.every(isTokenShapedDeclaration)) return full;
      if (decls.some(declarationLaundersIndigo)) return full;
      return '';
    },
  );
}

// Scan every `linear-gradient(...)` / `radial-gradient(...)` body for a
// blue→cyan two-stop trust gradient. Accepts hex stops or literal keywords.
function detectBlueCyanTrustGradient(html: string): string | null {
  const re = /(?:linear|radial)-gradient\([^)]*\)/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const grad = m[0].toLowerCase();
    const hasBlue =
      TRUST_GRADIENT_BLUE_HEXES.some((h) => grad.includes(h.toLowerCase())) ||
      /\bblue\b/.test(grad);
    const hasCyan =
      TRUST_GRADIENT_CYAN_HEXES.some((h) => grad.includes(h.toLowerCase())) ||
      /\bcyan\b/.test(grad);
    if (hasBlue && hasCyan) return m[0];
  }
  return null;
}

// ── Main entry ──────────────────────────────────────────────────────────────

export function lintHtml(rawHtml: string): LintFinding[] {
  const out: LintFinding[] = [];
  if (typeof rawHtml !== 'string' || rawHtml.length === 0) return out;

  // Strip HTML comments first — pedagogical examples inside comments
  // would otherwise fire false positives.
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '');

  // 1. purple-gradient (P0): gradient containing a PURPLE_HEXES value
  //    or the literal "purple"/"violet" keyword.
  let purpleFired = false;
  for (const hex of PURPLE_HEXES) {
    const m = new RegExp(
      `(?:linear|radial)-gradient\\([^)]*${escapeRe(hex)}[^)]*\\)`, 'i',
    ).exec(html);
    if (m) {
      out.push({
        severity: 'P0', id: 'purple-gradient',
        message: `Found a violet/purple gradient using ${hex} — anti-slop list says no.`,
        fix: 'Replace the gradient with a flat surface (var(--bg)/var(--surface)) or use the active accent at a single intensity.',
        snippet: clip(m[0]),
      });
      purpleFired = true;
      break;
    }
  }
  if (!purpleFired) {
    const m = /(?:linear|radial)-gradient\([^)]*\b(purple|violet)\b[^)]*\)/i.exec(html);
    if (m) {
      out.push({
        severity: 'P0', id: 'purple-gradient',
        message: `Found a "${m[1]}" keyword inside a gradient — anti-slop.`,
        fix: 'Remove the gradient or swap to a single solid color from the active design tokens.',
        snippet: clip(m[0]),
      });
      purpleFired = true;
    }
  }

  // 2. trust-gradient (P0): blue + cyan two-stop trust gradient.
  if (!purpleFired) {
    const tg = detectBlueCyanTrustGradient(html);
    if (tg) {
      out.push({
        severity: 'P0', id: 'trust-gradient',
        message: 'Found a blue→cyan two-stop "trust" gradient — anti-slop list says no.',
        fix: 'Replace with a flat surface (var(--bg)/var(--surface)) or a single design-token color. Two-stop blue→cyan gradients are a SaaS hero cliché.',
        snippet: clip(tg),
      });
    }
  }

  // 3. ai-default-indigo (P0): any AI_DEFAULT_INDIGO hex used as a SOLID.
  //    Strip :root / [data-theme] token blocks first so an intentional
  //    --accent:#6366f1 declaration is allowed but component literals fire.
  if (!purpleFired) {
    const htmlForIndigo = stripTokenBlocks(html);
    for (const hex of AI_DEFAULT_INDIGO) {
      const m = new RegExp(escapeRe(hex), 'i').exec(htmlForIndigo);
      if (m) {
        out.push({
          severity: 'P0', id: 'ai-default-indigo',
          message: `Found a default LLM accent color (${hex}) — this is the most-reported AI design tell.`,
          fix: `Replace ${hex} with var(--accent) from the active design system. If the brief truly requires indigo, encode it as the system's --accent so it reads as intentional.`,
          snippet: clip(m[0]),
        });
        break;
      }
    }
  }

  // 4. emoji-icon (P0): a SLOP_EMOJI inside h1-h6/button/li/a/span contexts.
  for (const e of SLOP_EMOJI) {
    if (!html.includes(e)) continue;
    const m = new RegExp(
      `<(?:h[1-6]|button|li|a|span)[^>]*>[^<]*${escapeRe(e)}`, 'i',
    ).exec(html);
    if (m) {
      out.push({
        severity: 'P0', id: 'emoji-icon',
        message: `Emoji "${e}" used as a UI icon — anti-slop list says SVG monoline only.`,
        fix: 'Replace with a small inline SVG icon (1.6–1.8px stroke, currentColor) or remove the icon entirely.',
        snippet: clip(m[0]),
      });
      break;
    }
  }

  // 5. left-accent-card (P0): rounded card with a colored left border —
  //    the canonical "AI dashboard tile" tell.
  const leftAccentRe =
    /\.[a-z-]+\s*\{[^}]*border-left\s*:\s*\d+px\s+solid\s+[^;]+;[^}]*border-radius\s*:\s*[1-9]/i;
  const lam = leftAccentRe.exec(html);
  if (lam) {
    out.push({
      severity: 'P0', id: 'left-accent-card',
      message: 'Rounded card with a coloured left border — the canonical AI-slop card pattern.',
      fix: 'Drop either the border-radius (set 0px) or the border-left. Cards should use hairline borders all-round, no left accent.',
      snippet: clip(lam[0]),
    });
  }

  // 6. invented-metric (P1): canonical AI-startup phrasings.
  for (const re of INVENTED_METRIC_PATTERNS) {
    const m = re.exec(html);
    if (m) {
      out.push({
        severity: 'P1', id: 'invented-metric',
        message: `Suspected invented metric: "${m[0]}". Anti-slop list says: no numbers without a real source.`,
        fix: 'Either remove the claim or replace with a placeholder (— or a labelled stub) until the user supplies a real number.',
        snippet: clip(m[0]),
      });
      break;
    }
  }

  // 7. filler (P1): lorem / placeholder copy.
  for (const re of FILLER_PATTERNS) {
    const m = re.exec(html);
    if (m) {
      out.push({
        severity: 'P1', id: 'filler',
        message: `Filler copy detected: "${m[0]}". Pages should ship with real, brief-derived copy.`,
        fix: 'Replace with copy specific to the brief or delete the section entirely.',
        snippet: clip(m[0]),
      });
      break;
    }
  }

  // 8. display-sans (P1): an h1/h2/h3 whose inline font-family lands on
  //    Inter/Roboto/Arial/system-ui/-apple-system without a serif before it.
  const displaySansInlineRe =
    /<(?:h1|h2|h3)\b[^>]*style\s*=\s*["'][^"']*font-family\s*:\s*["']?(?:Inter|Roboto|Arial|system-ui|-apple-system|SF\s+Pro)/i;
  const dm = displaySansInlineRe.exec(html);
  if (dm) {
    out.push({
      severity: 'P1', id: 'display-sans',
      message: 'A heading uses Inter / Roboto / system-sans as the display face — the seed binds a serif.',
      fix: 'Use `font-family: var(--font-display)` on h1/h2/h3 and let the active design system pick the serif.',
      snippet: clip(dm[0]),
    });
  }

  return out;
}
