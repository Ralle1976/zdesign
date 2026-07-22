// Z.Design — Agency Craft Layer
//
// Concrete, numerical specifications that lift generated HTML from "flat
// template" to "Awwwards showcase quality". These are NOT vague instructions
// ("use good spacing") — they are exact CSS values, grid rules, and animation
// snippets that the LLM must follow. Inspired by Minimax-M3 analysis of what
// separates generic AI landing pages from agency-grade work.

// ─── CONCEPT-VARIABLE LAYOUT SPECS ──────────────────────────────────────────
// FIX: The old AGENCY_LAYOUT_SPECS were identical for every design — always
// 12-col grid, always clamp(64-144px), always 1320px. That's exactly why every
// design looked the same. These specs are now DOMAIN-ADAPTIVE: the design
// direction (palette, fonts, mood) determines which spec set applies.

export interface ConceptSpecs {
  layout: string;
  typography: string;
  spacing: string;
  color: string;
  motion: string;
}

export function getConceptSpecs(domain: string, mood: string): ConceptSpecs {
  // Editorial/Magazine domains: huge typography, asymmetric layouts, warm colors
  if (domain.includes('food') || domain.includes('coffee') || domain.includes('restaurant') || domain.includes('bakery')) {
    return {
      layout: `
GRID: Asymmetrisches Editorial-Grid — KEIN gleichmäßiges 12-Spalten-Grid. Nutze: (a) 7-Spalten-Text + 5-Spalten-Bild mit Versatz, (b) Full-bleed Bild mit Text-Overlay unten links, (c) 2/3-1/3 Split mit overlapping Cards. KEINE zentrierte Single-Column.`,
      typography: `
TYPO-SKALA (Editorial, groß, atmend):
  H1: clamp(48px, 8vw, 128px) — font-weight 300 (dünn!), letter-spacing -0.03em, line-height 0.95, font-family: Display-Serif (Cormorant/Fraunces)
  H2: clamp(36px, 5vw, 64px) — font-weight 400, italic für Akzente
  Body: 18px, line-height 1.75, max-width 52ch
  Eyebrow: 11px uppercase, letter-spacing 0.3em (!), goldene Akzentfarbe`,
      spacing: `
ABSTÄNDE (editorial, großzügig):
  Section padding: clamp(120px, 18vh, 220px) vertical
  Text-Container: max-width 65ch (lesbar!), KEIN 1320px-Template-Container
  Inter-Element: 32px-80px`,
      color: `
FARB-TIEFE (warm, handwerklich, einladend):
  Background: Warme Creme/Elfenbein (#FAF6F0, #F5EFE6), KEIN reines Weiß
  Akzent: EINE warme Farbe (Terrakotta, Gold, Espresso) — sparsam, maximal 10% der Fläche
  Text: Warmes Dunkelbraun (#2B1B12, #1A1410), NIEMALS reines Schwarz
  Verläufe: Subtiler radial-gradient von warm-light zu warm-surface`,
      motion: `
BEWEGUNG (langsam, bedächtig, editorial):
  Reveal: opacity 0→1, translateY 40px→0, 1s cubic-bezier(0.22,1,0.36,1)
  Bilder: slow zoom (scale 1→1.08, 25s alternate infinite)
  Hover: subtle scale(1.03) mit 600ms ease
  KEIN schnelles Fade, KEIN bounce, KEIN shake`,
    };
  }
  // Tech/SaaS/Crypto domains: dark, modern, bold typography, dynamic
  if (domain.includes('crypto') || domain.includes('web3') || domain.includes('tech') || domain.includes('saas') || domain.includes('startup')) {
    return {
      layout: `
GRID: Modernes Bento-Grid — KEIN Editorial-Layout. Nutze: (a) Bento-Boxen mit verschiedenen Größen (2fr 1fr 1fr), (b) Full-bleed Dark-Hero mit Glow, (c) Stats-Dashboard mit großen Zahlen. KEINE Serif-Fonts.`,
      typography: `
TYPO-SKALA (Tech, fett, dynamisch):
  H1: clamp(56px, 10vw, 160px) — font-weight 600-800 (FETT!), letter-spacing -0.02em, font-family: Sans (Space Grotesk/Inter)
  H2: clamp(40px, 6vw, 80px) — font-weight 700
  Body: 16px, line-height 1.6, font-weight 400
  Mono-Akzente: JetBrains Mono für Code/Preise/Daten`,
      spacing: `
ABSTÄNDE (kompakt, dynamisch):
  Section padding: clamp(80px, 12vh, 160px)
  Container: max-width 1400px, padding 0 clamp(20px, 4vw, 48px)
  Inter-Element: 16px-48px`,
      color: `
FARB-TIEFE (dark, neon, dynamisch):
  Background: Deep Onyx (#0a0d12, #0B0F1A), KEIN Hellgrau
  Akzent: EINE vivide Farbe (Cyan #22D3EE, Indigo #6366F1, Emerald #10B981) — mit Glow
  Text: Off-White (#F1F5F9, #F5F4F0), NIEMALS grau
  Verläufe: Radial-gradient Glow hinter Hero-Element, conic-gradient Light-Sweep`,
      motion: `
BEWEGUNG (schnell, präzise, dynamisch):
  Reveal: opacity 0→1, translateY 24px→0, 600ms ease-out
  Hover: scale(1.05) mit 300ms transition, Glow-Effekt
  Scroll-Parallax: Elemente bewegen sich unterschiedlich schnell
  Sticky-Panels: Mind. 1 Sektion mit position:sticky`,
    };
  }
  // Luxury/Fashion/Premium domains: dark, minimal, elegant
  if (domain.includes('fashion') || domain.includes('luxury') || domain.includes('premium') || domain.includes('beauty') || domain.includes('watch') || domain.includes('jewelry')) {
    return {
      layout: `
GRID: Minimales Luxus-Grid — extrem viel Whitespace. Nutze: (a) Full-bleed Bild mit minimalem Text-Overlay, (b) Zentriertes Produkt mit symmetrischem Text, (c) Vertikale Split mit viel negativem Raum. KEINE Cards, KEINE Grids.`,
      typography: `
TYPO-SKALA (Luxus, dünn, elegant):
  H1: clamp(64px, 12vw, 200px) — font-weight 300 (EXTREM dünn!), letter-spacing -0.04em, font-family: Display-Serif (Cormorant/Playfair)
  H2: clamp(40px, 6vw, 96px) — font-weight 300, italic
  Body: 16px, line-height 1.8, font-weight 300, max-width 45ch
  Eyebrow: 10px uppercase, letter-spacing 0.4em (!), Gold`,
      spacing: `
ABSTÄNDE (extrem großzügig, luxuriös):
  Section padding: clamp(160px, 25vh, 300px)
  Container: max-width 1200px, viel Whitespace
  Inter-Element: 48px-120px`,
      color: `
FARB-TIEFE (dunkel, gold, luxuriös):
  Background: Deep Onyx (#08070a, #0a0a0a), KEIN Hell
  Akzent: EINE goldene Farbe (#C9A961, #B8860B, #D4AF37) — sparsam, wie Schmuck
  Text: Warm Off-White (#F4F1EC, #E8E2D4), NIEMALS kalt
  Verläufe: Subtiler radial-gradient Glow hinter Produkt, ambient lighting`,
      motion: `
BEWEGUNG (langsam, elegant, luxuriös):
  Reveal: opacity 0→1, translateY 60px→0, 1.5s cubic-bezier(0.22,1,0.36,1)
  Bilder: slow zoom (scale 1→1.1, 30s alternate infinite)
  Hover: subtle scale(1.02) mit 800ms ease, golden glow
  KEIN schnelles Fade, KEIN bounce, KEIN shake`,
    };
  }
  // Law/Corporate/Finance domains: structured, trustworthy, professional
  if (domain.includes('law') || domain.includes('finance') || domain.includes('corporate') || domain.includes('consulting') || domain.includes('insurance')) {
    return {
      layout: `
GRID: Strukturiertes Corporate-Grid — Vertrauen durch Ordnung. Nutze: (a) Zentrierte 3-Spalten-Features, (b) Stats-Bar mit großen Zahlen, (c) Team-Grid mit Fotos, (d) Testimonial-Carousel. KEINE Asymmetrie, KEINE kreative Layouts.`,
      typography: `
TYPO-SKALA (Corporate, vertrauenswürdig, strukturiert):
  H1: clamp(40px, 6vw, 80px) — font-weight 600, letter-spacing -0.02em, font-family: Serif (Source Serif Pro/Lora)
  H2: clamp(32px, 4vw, 56px) — font-weight 600
  Body: 17px, line-height 1.7, font-weight 400, max-width 60ch
  Eyebrow: 12px uppercase, letter-spacing 0.2em, Navy/Gold`,
      spacing: `
ABSTÄNDE (strukturiert, vertrauenswürdig):
  Section padding: clamp(96px, 14vh, 180px)
  Container: max-width 1280px, padding 0 clamp(24px, 4vw, 48px)
  Inter-Element: 24px-64px`,
      color: `
FARB-TIEFE (navy, gold, vertrauenswürdig):
  Background: Reines Weiß (#FFFFFF) oder sehr helles Grau (#F8FAFC), KEIN Dunkel
  Akzent: Navy (#0F2A47) + EINE Gold (#B08D57, #D4AF37) — klassisch, sparsam
  Text: Navy Dark (#0F1B2D, #1E293B), NIEMALS reines Schwarz
  Verläufe: Subtiler linear-gradient von White zu Light-Gray, KEIN Glow`,
      motion: `
BEWEGUNG (subtil, professionell, vertrauenswürdig):
  Reveal: opacity 0→1, translateY 20px→0, 800ms ease
  Hover: subtle shadow increase, KEIN scale, KEIN Glow
  Scroll: Smooth scrolling, KEIN Parallax, KEIN Sticky
  KEIN schnelles Fade, KEIN bounce, KEIN shake`,
    };
  }
  // Default: balanced editorial approach
  return {
    layout: `
GRID: 12-Spalten CSS Grid mit explizitem grid-template-areas. NIEMALS eine zentrierte Single-Column. Jede Sektion nutzt asymmetrische Spaltenpaare (8/4, 5/7, 7/5, 10/2), versetzt um 1-2 Spalten.`,
    typography: `
TYPO-SKALA (clamp für fluid scaling):
  H1: clamp(64px, 9vw, 144px) — font-weight 400 (NICHT bold!), letter-spacing -0.04em, line-height 0.95
  H2: clamp(40px, 5vw, 72px) — font-weight 500, letter-spacing -0.03em
  H3: clamp(24px, 3vw, 36px) — font-weight 600
  Body: 18px, line-height 1.65, letter-spacing 0
  Labels/Eyebrows: 12px, uppercase, letter-spacing 0.15em, font-weight 600`,
    spacing: `
ABSTÄNDE (generös, atemend):
  Section padding: clamp(96px, 14vh, 180px) vertical
  Container max-width: 1320px, padding 0 clamp(24px, 4vw, 48px)
  Inter-Element: 24px-64px (niemals <16px zwischen Sektionen)`,
    color: `
FARB-TIEFE (NICHT flach!):
  Background: KEINE flache Einfarbigkeit. IMMER ein subtiler Verlauf:
    linear-gradient(180deg, var(--bg) 0%, color-mix(in oklch, var(--surface) 50%, var(--bg)) 100%)
  Surface/Card: 1px hairline border: border: 1px solid color-mix(in oklch, var(--text) 8%, transparent)
  Shadows: GESCHICHTEXTE Schatten, nicht ein flacher:
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 32px 64px rgba(0,0,0,0.04)`,
    motion: `
BEWEGUNG (lebendig, nicht statisch):
  Reveal: opacity 0→1, translateY 40px→0, 1s cubic-bezier(0.22,1,0.36,1)
  Bilder: slow zoom (scale 1→1.08, 20s alternate infinite)
  Hover: scale(1.03) mit 600ms cubic-bezier transition
  Sticky-Panels: Mind. 1 Sektion mit position:sticky`,
  };
}

// ─── SCROLL-DRIVEN ANIMATIONS (native CSS, no JS) ────────────────────────────
export const AGENCY_ANIMATIONS = `
═══ SCROLL-ANIMATIONEN (BINDEND — macht das Design LEBENDIG) ═══

Jede Sektion MUSS mindestens EINE dieser drei Animationen nutzen:

1. REVEAL (Element erscheint beim Scrollen):
.reveal {
  animation: revealUp linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 35%;
}
@keyframes revealUp {
  from { opacity: 0; transform: translateY(48px); }
  to { opacity: 1; transform: translateY(0); }
}

2. PARALLAX (Element bewegt sich langsamer als Scroll):
[data-parallax] {
  animation: parallaxMove linear;
  animation-timeline: scroll(root);
}
@keyframes parallaxMove {
  from { transform: translateY(0); }
  to { transform: translateY(-120px); }
}

3. STICKY-PANEL (Sektion bleibt kleben während Content scrollt):
.sticky-panel {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  align-items: center;
}

ZUSÄTZLICH: Mindestens EINE dieser Micro-Interaktionen:
- Hero-Headline: text-mask reveal mit background-clip:text + Gradient
- Bilder: subtle scale(1.05) on hover mit 600ms cubic-bezier transition
- Buttons: background-position shift bei linear-gradient backgrounds
`;

// ─── CONCEPT ANCHOR (editorial storytelling) ──────────────────────────────────
export const AGENCY_CONCEPT = `
═══ KONZEPT-ANKER (BINDEND — macht das Design UNVERGESSLICH) ═══

Wähle EINE konkrete visuelle Metapher für dieses Design und ziehe sie konsequent durch. Beispiele:
- Bäckerei: "Zeit als Zutat" → Uhren/Mahlwerk-SVGs, Zeitstempel-Sektionen, langsame Animationen
- Anwalt: "Fels in der Brandung" → schwere Stein-Texturen, navy-Tiefe, feste geometrische Formen
- Spa: "Atem der Natur" → organische Kurven, Pflanzenmotive, fließende Übergänge
- Tech: "Kontrollraum" → Daten-Visualisierungen, Mono-Font-Akzente, dunkle Tiefe mit Glow

Die Metapher MUSS in mindestens 3 Elementen sichtbar sein:
  1. Ein wiederkehrendes visuelles Motiv (Inline-SVG, dekorativ)
  2. Ein Sektions-Name oder Headline der sie referenziert
  3. Eine Gesten-Animation die sie unterstützt (z.B. "langsam" für Zeit, "fließend" für Natur)
`;

// ─── POST-PROCESS CSS (deterministic injection after generation) ──────────────
// Injected AFTER the LLM generates HTML — guarantees a craft floor regardless
// of what the model produced. This is the "finishing touch" layer.

export const POST_PROCESS_CSS = `
<!-- AGENCY POST-PROCESS LAYER (deterministic craft floor) -->
<style id="__agency_craft__">
  /* Subtle film grain — adds texture, removes "flat digital" feel */
  body::before {
    content: '';
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 9999;
    opacity: 0.035;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  }
  /* Smooth scrolling with offset */
  html { scroll-behavior: smooth; }
  /* Premium selection style */
  ::selection { background: var(--accent, currentColor); color: var(--bg, #fff); }
  /* Hairline borders everywhere by default for cards */
  [class*="card"], [class*="Card"] {
    border: 1px solid color-mix(in oklch, currentColor 8%, transparent);
  }
  /* Image hover — subtle life */
  img { transition: transform 800ms cubic-bezier(0.22, 1, 0.36, 1); }
  img:hover { transform: scale(1.03); }
  /* Respect reduced motion */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
`;

/**
 * Inject the post-process CSS layer into generated HTML (before </body>).
 * This is the deterministic "finishing touch" — runs regardless of what the
 * LLM produced, guaranteeing a craft floor (noise, hairlines, hover life).
 */
export function injectAgencyCraft(html: string): string {
  if (html.includes('__agency_craft__')) return html; // already injected
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${POST_PROCESS_CSS}\n</body>`);
  }
  if (/<\/html>/i.test(html)) {
    return html.replace(/<\/html>/i, `${POST_PROCESS_CSS}\n</html>`);
  }
  return html + POST_PROCESS_CSS;
}

// ─── PREMIUM LUXE MODE (for high-end showcase sites) ─────────────────────────
// Injected when premium=true. Pushes the design from "good agency" to
// "Awwwards Site of the Day" — ultra-dark or ultra-light palettes, cinematic
// full-bleed imagery, dramatic typography, scroll-driven choreography.
export const AGENCY_PREMIUM_LUXE = `
═══ PREMIUM LUXE MODE (BINDEND — Awwwards-Niveau) ═══

DIES IST KEINE NORMALE LANDINGPAGE. Dies ist ein cineastisches Erlebnis. Behandle es wie einen Kinofilm, nicht wie eine Website.

DUNKELHEIT & LICHT:
  - Deep onyx/schwarz Hintergrund (#08070a bis #0f0d12), NIEMALS weiß oder hellgrau
  - EIN dramatisches Licht: golden, champagne, oder warmes amber — NIEMALS kalt
  - Ambient glow hinter dem Hero-Element: radial-gradient(circle, rgba(gold,0.12) 0%, transparent 60%)
  - Langsam rotierender Licht-Sweep über den gesamten Viewport: conic-gradient animation

TYPOGRAFIE (EXTREM):
  - Display: Cormorant Garamond oder Playfair Display, font-weight 300 (dünn!), italic für Akzente
  - H1: clamp(64px, 9vw, 144px), line-height 0.9, letter-spacing -0.04em
  - Body: Inter oder Mulish, font-weight 300, 16px, line-height 1.8, max-width 50ch
  - Eyebrow: 11px uppercase, letter-spacing 0.3em (!), goldene Farbe
  - Mono-Akzente: JetBrains Mono für Preise/Referenznummern

LAYOUT-CHOREOGRAFIE:
  - Hero: DREI Spalten (Text links / Produkt ZENTRIERT / Preis+CTA rechts) — asymmetrisch
  - Sticky Panels: mind. 1 Sektion mit position:sticky (Bild bleibt, Text scrollt dran vorbei)
  - Full-bleed Sektionen: Bilder decken 100vh, Text overlaid mit Gradient
  - KEINE gleichmäßigen 3-Spalten-Karten. Stattdessen: 1 großes Bild + offset Textblock

BEWEGUNG (lebendig, nicht statisch):
  - Hero-Produkt: sanftes float (translateY 6s loop), mit perspective + rotateY
  - Jede Sektion: reveal-on-scroll via IntersectionObserver (opacity 0→1, translateY 40px→0)
  - Bilder: slow zoom (scale 1→1.08, 20s alternate infinite)
  - Hover auf Bildern: scale(1.05) mit 1.2s cubic-bezier transition
  - Light sweep: conic-gradient der langsam über den Hintergrund rotiert (20s linear)

DIE EINE GESTE (unvergesslich):
  - Ein wiederkehrendes visuelles Motiv (z.B. rotierender goldener Ring um das Produkt)
  - Eine Headline die man sich merkt (kurz, poetisch, kontrastiv)
  - Ein Moment der Stille (viel Whitespace/Schwarz zwischen Sektionen)

PREMIUM-CSS-SCHNIPSEL (nutze diese exakt):
  body::before { /* film grain */ content:''; position:fixed; inset:0; pointer-events:none; z-index:9999; opacity:0.04; background:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
  .hero-glow { position:absolute; width:60vw; height:60vw; max-width:700px; border-radius:50%; background:radial-gradient(circle, rgba(gold,0.12) 0%, transparent 60%); animation: pulse 8s ease-in-out infinite; }
  .reveal { opacity:0; transform:translateY(40px); transition:opacity 1s cubic-bezier(0.22,1,0.36,1), transform 1s cubic-bezier(0.22,1,0.36,1); }
  .reveal.visible { opacity:1; transform:translateY(0); }
  html { scroll-behavior:smooth; }
  ::selection { background:var(--gold); color:var(--onyx); }
`;

