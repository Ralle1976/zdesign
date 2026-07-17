/**
 * ultra-quality.ts — Shared agency-level quality bar for all generation passes.
 */

export const ULTRA_QUALITY_BAR = `
═══ ULTRA-QUALITÄT (AGENTUR-NIVEAU — BINDEND) ═══
- WOW-Faktor: eine mutige Signatur-Geste pro Seite (asymmetrischer Hero, diagonal cut, overlapping card, cinematic full-bleed).
- Atmosphäre: KEINE flachen Flächen — Verlauf + geschichtete Schatten + dezentes Film-Korn (SVG noise opacity 0.03–0.05).
- Typo: Display-Schrift für H1, clamp()-Skala, Eyebrow-Labels über H2 (12px uppercase, Akzentfarbe).
- Bilder: NUR die vorgegebenen generierten URLs — groß, object-fit:cover, Gradient-Overlay wo Text auf Bild.
- Motion: Hover-Micro-Interactions, gestaffeltes Fade-in, prefers-reduced-motion respektieren.
- VERBOTEN: generisches 3-Spalten-Grid in jeder Sektion, Default-Indigo/Violett (#6366f1), „Get Started", Stock-Mix.
`.trim();

export const ULTRA_IMAGE_RULES = `
BILDER (PFLICHT):
- Jede View mindestens 1 großes Foto aus den vorgegebenen URLs.
- Alle Fotos gleiche Lichtstimmung / Palette-Grade — wie eine Editorial-Serie.
- Keine Unsplash-, keine Platzhalter-, keine anderen Bild-URLs.
`.trim();