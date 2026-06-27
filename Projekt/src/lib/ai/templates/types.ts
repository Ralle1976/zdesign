/**
 * templates/types.ts — the Z.Design reference-template model.
 *
 * A Template is a PRE-BAKED, named design that generation ADAPTS rather than
 * invents. This is the quality FLOOR (the lesson from Open Design / onepage:
 * they generate FROM a reference, not from zero — which is why they hit 8+
 * while from-zero caps ~6-7). Each template carries:
 *
 *   - spec:    the design DNA (palette hexes, fonts, signature gesture, layout)
 *   - referenceHtml: a polished HTML doc the generator loads as the starting
 *              point and customises to the new brief (NOT regenerated from zero)
 *
 * Templates are seeded from Z.Design's own best designs (the flagship showcase)
 * and grow: any design that passes the vision-critique loop can be promoted
 * into a template. Native to our stack — no external template dependency.
 *
 * (Format inspired by Open Design's SKILL.md + example.html pattern; Apache-2.0
 *  lets us vendor specific ones if ever useful, but we build ours.)
 */

export interface TemplatePalette {
  background: string;
  surface: string;
  primary: string;
  accent: string;
  text: string;
  textMuted?: string;
  border?: string;
}

export interface TemplateFonts {
  display: string;
  body: string;
}

/** The signature creative axes this template is built around (from creative-diversity). */
export interface TemplateSignature {
  /** Structural gesture, e.g. 'Split-Screen', 'Card-Stack', 'Magazin-Editorial'. */
  layout: string;
  /** Motion recipes, e.g. ['Parallax-Tiefe', 'Cursor-Magnet']. */
  motion: string[];
  /** Materiality effect, e.g. 'Glassmorphism', 'Neon-Glow', '3D-Hover-Tilt'. */
  effect: string;
}

export interface Template {
  /** Stable id, kebab-case. */
  id: string;
  /** Display name, e.g. 'Studio Beton'. */
  name: string;
  /** Human label for the router/trace, e.g. 'dark-architecture · card-stack'. */
  label: string;
  /** Domains this template suits (matched against deriveDesignDirection domain). */
  domainFit: string[];
  palette: TemplatePalette;
  fonts: TemplateFonts;
  signature: TemplateSignature;
  /** Path to the reference HTML (under src/lib/ai/templates/refs/), loaded by the generator. */
  referencePath: string;
}
