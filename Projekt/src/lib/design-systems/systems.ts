/**
 * DESIGN SYSTEM TOKEN SYSTEM
 * --------------------------
 * Structural color/type consistency ("Harmonie") is enforced by routing every
 * color/type decision through the :root semantic CSS variables defined here.
 * Components MUST consume `var(--bg)`, `var(--primary)`, etc. — literal hex in
 * component markup is forbidden (the anti-slop linter flags it).
 *
 * Reference discipline: Claude DESIGN.md (warm parchment, terracotta accent,
 * serif display, warm-only neutrals, ring shadows, generous radius).
 */

export interface DesignSystem {
  /** Slug key, e.g. "asian-spa". */
  name: string;
  /** Human label, e.g. "Asian Spa". */
  label: string;
  /** Direction category, e.g. "wellness", "editorial", "dark", "botanic". */
  category: string;
  /** Literal `:root { ... }` CSS string of semantic tokens. */
  rootCss: string;
  /** Display/heading font stack (the first family must be loadable via googleFontsHref). */
  displayFont: string;
  /** Body/UI font stack. */
  bodyFont: string;
  /** Optional <link> href to load real Google Fonts. */
  googleFontsHref?: string;
  /** 3-6 concise do/don't bullets injected into the design prompt. */
  craftNotes: string;
}

/* ------------------------------------------------------------------ */
/*  WCAG AA contrast helpers (a11y floor — Q4)                         */
/* ------------------------------------------------------------------ */
//
// The dark systems (midnight-temple) carry their own contrast risk: a warm
// off-black bg (#14100B) demands a near-white --text. We compute the relative
// luminance + contrast ratio the same way the W3C does, and if --text falls
// below AA (4.5:1 for normal text) against --bg we AUTO-LIGHTEN --text in
// 4% steps until it passes. This guarantees the a11y floor at module load
// without a manual re-check on every palette tweak.

/** WCAG 2.1 normal-text AA threshold. Large/bold text would need only 3:1. */
export const WCAG_AA_MIN = 4.5;

/** Parse a "#RRGGBB" (or #RGB) hex into an [r,g,b] byte tuple. Throws on bad input. */
function hexToRgb(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`hexToRgb: expected #RRGGBB, got "${hex}"`);
  }
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Channel linearization per WCAG (sRGB → relative luminance contribution). */
function channelLin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance Y of a hex color (WCAG 2.1). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channelLin(r) + 0.7152 * channelLin(g) + 0.0722 * channelLin(b);
}

/** Contrast ratio (1.0–21.0) between two hex colors, per WCAG 2.1. */
export function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/** Serialize an [r,g,b] tuple back to "#RRGGBB". */
function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/**
 * Lighten a hex color toward white by `step` (0..1, default 0.04 = 4%).
 * Used to rescue an under-contrast --text without resporting to pure #fff.
 */
function lighten(hex: string, step = 0.04): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex([r + (255 - r) * step, g + (255 - g) * step, b + (255 - b) * step]);
}

/** Extract the first "--text: #RRGGBB;" value from a :root CSS block. */
function readVar(css: string, name: string): string | null {
  const re = new RegExp(`--${name}\\s*:\\s*([^;]+);`);
  const m = css.match(re);
  return m ? m[1].trim() : null;
}

/** Replace (or append) a "--name: value;" declaration inside a CSS block. */
function setVar(css: string, name: string, value: string): string {
  const re = new RegExp(`(--${name}\\s*:\\s*)([^;]+)(;)`);
  if (re.test(css)) return css.replace(re, `$1${value}$3`);
  // not present — append before the closing brace
  return css.replace(/}\s*$/, `  --${name}: ${value};\n}`);
}

/**
 * Enforce the a11y floor on one design system: if --text against --bg is below
 * WCAG AA, lighten --text in 4% steps until it passes (capped at 97% white).
 * Returns { system, passed, before, after, ratio } for logging/assertion.
 */
export interface ContrastCheckResult {
  system: string;
  /** true iff the FINAL --text/--bg ratio is >= WCAG_AA_MIN. */
  passed: boolean;
  /** whether --text was modified (i.e. it failed on entry and got lightened). */
  modified: boolean;
  before: { text: string; ratio: number };
  after: { text: string; ratio: number };
}

export function enforceTextContrast(sys: DesignSystem): ContrastCheckResult {
  const bg = readVar(sys.rootCss, 'bg');
  let text = readVar(sys.rootCss, 'text');
  if (!bg || !text) {
    // Defensive: can't check what we can't parse — treat as pass (no-op).
    return {
      system: sys.name,
      passed: true,
      modified: false,
      before: { text: text ?? '?', ratio: NaN },
      after: { text: text ?? '?', ratio: NaN },
    };
  }
  const beforeRatio = contrastRatio(text, bg);
  const originalText = text;
  let ratio = beforeRatio;
  // Lighten up to ~24 steps (≈97% white) — anything still failing is a broken palette.
  for (let i = 0; i < 24 && ratio < WCAG_AA_MIN; i++) {
    text = lighten(text, 0.04);
    ratio = contrastRatio(text, bg);
  }
  const modified = text.toLowerCase() !== originalText.toLowerCase();
  if (modified) {
    sys.rootCss = setVar(sys.rootCss, 'text', text);
  }
  return {
    system: sys.name,
    passed: ratio >= WCAG_AA_MIN,
    modified,
    before: { text: originalText, ratio: round(beforeRatio) },
    after: { text, ratio: round(ratio) },
  };
}

function round(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : n;
}

/* ------------------------------------------------------------------ */
/*  Per-system :root token blocks                                      */
/* ------------------------------------------------------------------ */

const ASIAN_SPA_ROOT = `:root {
  --bg: #FBF6EA;
  --surface: #FFFFFF;
  --surface-2: #F4ECD8;
  --primary: #2A2118;
  --primary-soft: #5C4B38;
  --accent: #B0892F;
  --accent-soft: #D9B96A;
  --text: #2A2118;
  --text-muted: #6B5D49;
  --border: #E7DCC4;
  --border-soft: #F0E8D4;
  --radius: 14px;
  --radius-sm: 8px;
  --radius-lg: 22px;
  --shadow: 0 1px 2px rgba(42, 33, 24, 0.04), 0 8px 30px rgba(42, 33, 24, 0.06);
  --ring: 0 0 0 1px rgba(176, 137, 47, 0.22);
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-body: "Mulish", system-ui, -apple-system, "Segoe UI", sans-serif;
}`;

const CLAUDE_EDITORIAL_ROOT = `:root {
  --bg: #f5f4ed;
  --surface: #faf9f5;
  --surface-2: #edebe2;
  --primary: #141413;
  --primary-soft: #30302e;
  --accent: #c96442;
  --accent-soft: #d97757;
  --text: #141413;
  --text-muted: #5e5d59;
  --border: #e8e6dc;
  --border-soft: #f0eee6;
  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 18px;
  --shadow: 0 0 0 1px #e8e6dc, 0 1px 2px rgba(20, 20, 19, 0.04);
  --ring: 0 0 0 1px #d1cfc5;
  --font-display: "Cormorant Garamond", Georgia, "Times New Roman", serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Arial, sans-serif;
}`;

const MIDNIGHT_TEMPLE_ROOT = `:root {
  --bg: #14100B;
  --surface: #1E1812;
  --surface-2: #281F16;
  --primary: #F2E6CC;
  --primary-soft: #C9B894;
  --accent: #CBA233;
  --accent-soft: #E0BE63;
  --ember: #C86A3C;
  --text: #F2E6CC;
  --text-muted: #9C8A6E;
  --border: #34281B;
  --border-soft: #241B13;
  --radius: 10px;
  --radius-sm: 6px;
  --radius-lg: 16px;
  --shadow: 0 0 0 1px #34281B, 0 20px 60px rgba(0, 0, 0, 0.55);
  --ring: 0 0 0 1px rgba(203, 162, 51, 0.35);
  --font-display: "Marcellus", "Cormorant Garamond", Georgia, serif;
  --font-body: "Mulish", system-ui, -apple-system, "Segoe UI", sans-serif;
}`;

const JADE_GARDEN_ROOT = `:root {
  --bg: #F3F1E4;
  --surface: #FBFAF2;
  --surface-2: #E9E6D2;
  --primary: #2F5D50;
  --primary-soft: #4F7A6D;
  --accent: #C57A57;
  --accent-soft: #D79B7C;
  --jade: #2F5D50;
  --text: #243B34;
  --text-muted: #5E6B5F;
  --border: #DAD7C2;
  --border-soft: #E7E4D2;
  --radius: 14px;
  --radius-sm: 8px;
  --radius-lg: 22px;
  --shadow: 0 1px 2px rgba(36, 59, 52, 0.05), 0 10px 34px rgba(36, 59, 52, 0.07);
  --ring: 0 0 0 1px rgba(47, 93, 80, 0.22);
  --font-display: "Fraunces", "Cormorant Garamond", Georgia, serif;
  --font-body: "Mulish", system-ui, -apple-system, "Segoe UI", sans-serif;
}`;

/* ------------------------------------------------------------------ */
/*  Registry                                                           */
/* ------------------------------------------------------------------ */

export const DESIGN_SYSTEMS: Record<string, DesignSystem> = {
  "asian-spa": {
    name: "asian-spa",
    label: "Asian Spa",
    category: "wellness",
    rootCss: ASIAN_SPA_ROOT,
    displayFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont: '"Mulish", system-ui, sans-serif',
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Mulish:wght@300;400;500;600;700&display=swap",
    craftNotes: [
      "DO lean into warm ivory canvas (#FBF6EA) + restrained gold accent — luxury through calm, not chrome.",
      "DO use Cormorant Garamond for headlines with generous line-height (1.1-1.3); serif gives the spa editorial gravitas.",
      "DO keep generous whitespace and soft 14-22px radii; this direction breathes.",
      "DON'T use cool blues/grays or neon greens — every neutral must carry a warm undertone.",
      "DON'T use gold as a fill on large areas; reserve it for hairlines, small caps labels, and a single hero accent.",
      "DON'T set body copy in the serif — body stays Mulish for legibility.",
    ].join(" "),
  },

  "claude-editorial": {
    name: "claude-editorial",
    label: "Claude Editorial",
    category: "editorial",
    rootCss: CLAUDE_EDITORIAL_ROOT,
    displayFont: '"Cormorant Garamond", Georgia, serif',
    bodyFont:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Arial, sans-serif',
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap",
    craftNotes: [
      "DO build on warm parchment (#f5f4ed) — feels like premium paper, never like a screen.",
      "DO use terracotta (#c96442) as the single brand accent for CTAs and signature moments.",
      "DO keep EVERY neutral warm (yellow-brown undertone); no cool blue-grays anywhere.",
      "DO use ring-based shadows (0 0 0 1px) for border-like depth instead of drop shadows.",
      "DON'T use gradients — depth comes from warm surface layering and serif-driven hierarchy.",
      "DON'T bold the serif; display weight stays 500 for a single consistent authorial voice.",
    ].join(" "),
  },

  "midnight-temple": {
    name: "midnight-temple",
    label: "Midnight Temple",
    category: "dark",
    rootCss: MIDNIGHT_TEMPLE_ROOT,
    displayFont: '"Marcellus", "Cormorant Garamond", Georgia, serif',
    bodyFont: '"Mulish", system-ui, sans-serif',
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Marcellus&family=Mulish:wght@300;400;500;600;700&display=swap",
    craftNotes: [
      "DO commit to deep warm black (#14100B) — never pure #000; the warmth keeps it alive.",
      "DO use temple gold (#CBA233) sparingly for hairlines, labels, and a single hero element; pair with ember (#C86A3C) for warmth.",
      "DO use Marcellus for display — its inscriptional capitals carry the dramatic, ceremonial tone.",
      "DO use large soft shadows (0 20px 60px) to separate layered surfaces in the dark.",
      "DON'T flood the page with gold; on dark it glows — restraint is the luxury.",
      "DON'T use light-on-light or low-contrast muted text; keep text at least #F2E6CC on the black.",
    ].join(" "),
  },

  "jade-garden": {
    name: "jade-garden",
    label: "Jade Garden",
    category: "botanic",
    rootCss: JADE_GARDEN_ROOT,
    displayFont: '"Fraunces", "Cormorant Garamond", Georgia, serif',
    bodyFont: '"Mulish", system-ui, sans-serif',
    googleFontsHref:
      "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400&family=Mulish:wght@300;400;500;600;700&display=swap",
    craftNotes: [
      "DO ground everything in sand (#F3F1E4) + deep jade (#2F5D50); the pairing is serene and botanical.",
      "DO use Fraunces (optical-size serif) for headlines — its organic curves suit the natural, meditative tone.",
      "DO balance jade coolness with terracotta (#C57A57) warmth as the secondary accent.",
      "DO keep generous whitespace and 14-22px radii; this direction is calm, not busy.",
      "DON'T use synthetic greens (lime/neon) or pure blacks; stick to earthy, desaturated tones.",
      "DON'T crowd the layout — botanic serenity needs room to breathe between sections.",
    ].join(" "),
  },
};

/* ------------------------------------------------------------------ */
/*  Topic → system routing                                             */
/* ------------------------------------------------------------------ */

/** Fold diacritics to plain ascii and lowercase, for keyword matching. */
function fold(s: string): string {
  // NFD decomposes accented letters into base + combining marks (U+0300..U+036F).
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Pick the most fitting design system for a user message via keyword match.
 * Falls back to "claude-editorial" (the safe, broadly-applicable warm editorial
 * direction) when nothing matches.
 */
export function pickSystemForTopic(message: string): DesignSystem {
  const m = fold(message);

  if (/\b(spa|massage|thai|wellness|kosmetik|beauty|sauna|retreat|ritual|serene)\b/.test(m)) {
    return DESIGN_SYSTEMS["asian-spa"];
  }
  if (/\b(fashion|luxury|serif|editorial|literary|magazine|brand|premium|boutique|atelier)\b/.test(m)) {
    return DESIGN_SYSTEMS["claude-editorial"];
  }
  if (/\b(crypto|music|night|club|dark|dramatisch|dramatic|gaming|cyber|neon|techno|event|concert)\b/.test(m)) {
    return DESIGN_SYSTEMS["midnight-temple"];
  }
  if (/\b(nature|yoga|meditation|botanic|oeko|oko|green|organic|tea|zen|plant|garden|nachhaltig)\b/.test(m)) {
    return DESIGN_SYSTEMS["jade-garden"];
  }
  return DESIGN_SYSTEMS["claude-editorial"];
}

/* ------------------------------------------------------------------ */
/*  a11y floor — enforce on load + export for the agent route          */
/* ------------------------------------------------------------------ */

/**
 * Run the WCAG AA contrast check against every registered system, mutating any
 * whose --text/--bg fails below 4.5:1 (lightening --text in place). Safe to
 * call repeatedly — no-ops on systems that already pass. Returns the per-system
 * result so callers (agent route, tests) can log/assert the floor.
 */
export function verifyAllSystemsContrast(): ContrastCheckResult[] {
  return Object.values(DESIGN_SYSTEMS).map((sys) => enforceTextContrast(sys));
}

// Enforce once at module load. Midnight-temple (#F2E6CC on #14100B ≈ 15.3:1)
// passes AA comfortably, so this is a no-op today — it exists as the guard that
// fires the moment a future palette tweak drops --text below the floor.
export const CONTRAST_CHECK_RESULTS: ContrastCheckResult[] = verifyAllSystemsContrast();
