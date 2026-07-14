// Z.Design — Agency Craft Layer
//
// Concrete, numerical specifications that lift generated HTML from "flat
// template" to "Awwwards showcase quality". These are NOT vague instructions
// ("use good spacing") — they are exact CSS values, grid rules, and animation
// snippets that the LLM must follow. Inspired by Minimax-M3 analysis of what
// separates generic AI landing pages from agency-grade work.

// ─── CONCRETE LAYOUT SPECS (inject into prompt) ──────────────────────────────
// Without exact numbers, GLM defaults to 16px/centered/40px-padding = flat.
export const AGENCY_LAYOUT_SPECS = `
═══ AGENCY LAYOUT-SPEZIFIKATIONEN (BINDEND — exakt diese Werte) ═══

GRID: 12-Spalten CSS Grid mit explizitem grid-template-areas. NIEMALS eine zentrierte Single-Column. Jede Sektion nutzt asymmetrische Spaltenpaare (8/4, 5/7, 7/5, 10/2), versetzt um 1-2 Spalten.

TYPO-SKALA (clamp für fluid scaling):
  H1: clamp(64px, 9vw, 144px) — font-weight 400 (NICHT bold!), letter-spacing -0.04em, line-height 0.95
  H2: clamp(40px, 5vw, 72px) — font-weight 500, letter-spacing -0.03em
  H3: clamp(24px, 3vw, 36px) — font-weight 600
  Body: 18px, line-height 1.65, letter-spacing 0
  Labels/Eyebrows: 12px, uppercase, letter-spacing 0.15em, font-weight 600

ABSTÄNDE (generös, atemend):
  Section padding: clamp(96px, 14vh, 180px) vertical
  Container max-width: 1320px, padding 0 clamp(24px, 4vw, 48px)
  Inter-Element: 24px-64px (niemals <16px zwischen Sektionen)

FARB-TIEFE (NICHT flach!):
  Background: KEINE flache Einfarbigkeit. IMMER ein subtiler Verlauf:
    linear-gradient(180deg, var(--bg) 0%, color-mix(in oklch, var(--surface) 50%, var(--bg)) 100%)
  Surface/Card: 1px hairline border: border: 1px solid color-mix(in oklch, var(--text) 8%, transparent)
  Shadows: GESCHICHTEXTE Schatten, nicht ein flacher:
    box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06), 0 32px 64px rgba(0,0,0,0.04)
`;

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

