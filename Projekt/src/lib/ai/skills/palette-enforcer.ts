// Z.Design — Palette Enforcer (deterministic post-generation token enforcement)
//
// PROBLEM: GLM-5.2 ignores the concept palette tokens in the prompt — it
// substitutes its own hexes (#EC4899 instead of the specified #FF006E).
// The prompt is correct; the model doesn't follow it.
//
// FIX: after generation (and after each refine), DETERMINISTICALLY replace
// the :root token values + font declarations with the concept's specified
// values. Zero token cost, <1ms, guaranteed palette fidelity. This is the
// complement to the anti-slop linter: the linter DETECTS wrong colors,
// the enforcer CORRECTS them to the concept's palette.

import type { Concept } from './creative-director';

/**
 * Force the concept's palette + fonts into the HTML's :root and font-family
 * declarations, regardless of what the model emitted. Returns the corrected HTML.
 * If no concept or no palette, returns the HTML unchanged.
 */
export function enforceConceptTokens(html: string, concept: Concept | null | undefined): string {
  if (!concept?.palette) return html;

  let fixed = html;
  const cp = concept.palette;

  // 1. Replace :root CSS variable values with concept values
  const tokenMap: Record<string, string | undefined> = {
    '--bg': cp.bg,
    '--surface': cp.surface,
    '--primary': cp.primary,
    '--accent': cp.accent,
    '--text': cp.text,
    '--text-muted': cp.textMuted,
    '--border': cp.border,
    '--background': cp.bg,      // alternate naming
    '--accent-color': cp.accent,
    '--text-color': cp.text,
  };

  for (const [token, value] of Object.entries(tokenMap)) {
    if (!value) continue;
    // Match: --token: <anything>; → --token: <value>;
    const regex = new RegExp(`(${token.replace(/[-]/g, '\\-')}\\s*:\\s*)[^;]+;`, 'gi');
    fixed = fixed.replace(regex, `$1 ${value};`);
  }

  // 2. Replace font-family declarations
  if (concept.fonts?.display) {
    // Replace --font-display: ...; and any font-family: "OldDisplay" near headings
    fixed = fixed.replace(/(--font-display\s*:\s*)[^;]+;/gi, `$1 "${concept.fonts.display}", sans-serif;`);
    // Also catch h1/h2 font-family inline if they hardcode a different font
    fixed = fixed.replace(/(h[12][^{]*\{[^}]*font-family\s*:\s*)[^;]+;/gi, `$1 "${concept.fonts.display}", sans-serif;`);
  }
  if (concept.fonts?.body) {
    fixed = fixed.replace(/(--font-body\s*:\s*)[^;]+;/gi, `$1 "${concept.fonts.body}", sans-serif;`);
    fixed = fixed.replace(/(body[^{]*\{[^}]*font-family\s*:\s*)[^;]+;/gi, `$1 "${concept.fonts.body}", sans-serif;`);
  }

  // 3. Inject Google Fonts <link> for the concept fonts if missing
  if (concept.fonts?.googleFontsHref) {
    if (!fixed.includes('fonts.googleapis.com') || !fixed.includes(concept.fonts.display.split(',')[0].trim())) {
      const linkTag = `<link href="${concept.fonts.googleFontsHref}" rel="stylesheet">`;
      // Insert after existing <link> tags or after <head>
      if (fixed.includes('</title>')) {
        fixed = fixed.replace('</title>', `</title>\n  ${linkTag}`);
      } else if (fixed.includes('<head>')) {
        fixed = fixed.replace('<head>', `<head>\n  ${linkTag}`);
      }
    }
  }

  return fixed;
}
