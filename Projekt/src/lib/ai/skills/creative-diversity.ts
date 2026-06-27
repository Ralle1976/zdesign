// Z.Design — "Creative Diversity" skill (the anti-sameness / motion engine).
//
// PROBLEM this solves: designs within the SAME domain (e.g. three coffee
// roasters, four spas) come out structurally identical — same centered hero,
// same 3-card grid, same static layout — because `design-direction.ts` assigns
// ONE archetype per topic deterministically. That archetype is the domain's
// DNA (good for topic-fit), but it gives NO variety ACROSS designs of the same
// kind, and it gives NO movement ("kein Leben", "kein Video-Gefühl").
//
// FIX — a THIRD axis layered ON TOP of the domain archetype. Three orthogonal
// creative dimensions, each picked by a deterministic hash of a per-design
// seed, so two designs of the same topic diverge structurally + cinematically:
//
//   AXIS 1 — LAYOUT_ARCHETYPE : a structural GESTURE (sticky-pin, split-screen,
//            bento, magazine-columns …). Orthogonal to the domain mood, so it
//            composes with design-direction's archetype instead of fighting it.
//   AXIS 2 — MOTION_RECIPES   : 2 concrete CSS/JS animation techniques from
//            DIFFERENT families (entrance / ambient / depth / interactive /
//            text). This is where the "Leben" + video-feeling comes from.
//   AXIS 3 — VISUAL_EFFECT    : 1 materiality polish (glass, grain, 3D-hover,
//            glitch, custom cursor, neon glow).
//
// All CSS/SVG/JS — no external video API needed (real generated video would
// require Higgsfield/Runway; that's a separate project). The motion recipes
// deliver the cinematic feel reliably and cheaply. Every motion respects
// prefers-reduced-motion (accessibility is non-negotiable).
//
// Pure + deterministic: same seed ⇒ same axes. No I/O, no LLM. The route picks
// the seed — for the agent it's the user message; for a batch it's
// `${name}|${theme}` so each brief in the batch lands on different axes.

// ─── Types ────────────────────────────────────────────────────────────

export interface LayoutArchetype {
  id: string;
  name: string;
  /** Concrete structural directive (German, model-facing). */
  directive: string;
}

/** Motion family — the picker chooses 2 motions from DIFFERENT families. */
export type MotionFamily = 'entrance' | 'ambient' | 'depth' | 'interactive' | 'text';

export interface MotionRecipe {
  id: string;
  name: string;
  family: MotionFamily;
  /** Concrete CSS/JS technique (German, model-facing, concise). */
  technique: string;
}

export interface VisualEffect {
  id: string;
  name: string;
  technique: string;
}

export interface CreativeAxes {
  archetype: LayoutArchetype;
  motions: MotionRecipe[]; // 2, from distinct families
  effect: VisualEffect;
}

export type CreativeMode = 'full' | 'motion-only';

// ─── AXIS 1 — Layout archetypes (structural gestures) ─────────────────

export const LAYOUT_ARCHETYPES: LayoutArchetype[] = [
  {
    id: 'split-screen',
    name: 'Split-Screen',
    directive:
      'Hero (und mindestens eine weitere Sektion) als 50/50-Spaltensplit (grid-template-columns:1fr 1fr): eine Seite Text/Typo, die andere Vollbild. Die Seiten wechseln bei jedem Scroll-Schritt die Seite (links↔rechts), sodass ein Rhythmus entsteht — kein zentrierter Einheits-Hero.',
  },
  {
    id: 'horizontal-scroll',
    name: 'Horizontal-Scroll-Sektion',
    directive:
      'Eine Sektion (z. B. Leistungen/Projekte) scrollt HORIZONTAL: JS übersetzt vertikales Scrollen in transform:translateX(), die Karten gleiten seitwärts durch. Rest der Seite scrollt normal vertikal. Klare Fortschrittsanzeige. Ein unverwechselbares Bewegungs-Moment.',
  },
  {
    id: 'sticky-pin',
    name: 'Sticky-Pin / Layering',
    directive:
      'Sektionen pinnen mit position:sticky (top:0) und überlagern sich beim Scrollen: die neue Sektion schiebt sich über die vorherige (z-index-Gestaffel, leichter scale/translate der unteren). Erzeugt eine Kapitel-/Story-Erzählung statt flacher Aneinanderreihung.',
  },
  {
    id: 'bento-grid',
    name: 'Bento-Grid',
    directive:
      'Asymmetrisches Kachel-Grid via CSS grid: grid-auto-rows gleiches Maß, einzelne Kacheln spannen mit grid-column/row:span N über mehrere Felder. Jede Kachel eigene Größe & Inhalt (Bild, Statistik, Zitat, Feature). Kein gleichmäßiges 3-Spalten-Raster — organische, japanische Bento-Box-Logik.',
  },
  {
    id: 'fullbleed-immersive',
    name: 'Full-bleed Immersiv',
    directive:
      'Randlose 100vh-Vollbild-Sektionen als „Kapitel": object-fit:cover Bilder/Verläufe randlos, Typo als Overlay (gemischte Ausrichtung, nicht nur zentriert). Sektionen trennen sich durch vollen Wechsel von Bild/Ton — filmische Kapitelstruktur.',
  },
  {
    id: 'magazine-editorial',
    name: 'Magazin-Editorial',
    directive:
      'Print-Magazin-Layout: mehrspaltiger Textfluss (CSS columns), großer Schmuck-Initial (Drop-Cap), seitliche Marginalien/Seitenzahlen-ähnliche Eyebrows, Abbildungen mit Bildunterschriften „fließen" um den Text. Wirkt wie ein hochwertiges Magazin, nicht wie eine Landingpage.',
  },
  {
    id: 'brutalist',
    name: 'Neo-Brutalismus',
    directive:
      'Roher, ehrlicher Rasterstil: dicke durchgezogene Borders (2-4px, kontrastierende Farbe), harte Schatten (offset solid, kein weicher Blur), Mono- oder geometrische Typo, sichtbares Raster, grelle Akzent-Flächen. Bewusster Bruch zum polierten SaaS-Look — mutig und memorabel.',
  },
  {
    id: 'card-stack',
    name: 'Card-Stack',
    directive:
      'Gestapelte Vollbild-Karten: beim Scrollen pinnt die obere Karte, die nächste schiebt sich von unten drüber (transform:translateY + scale der darunterliegenden 0.92 + opacity). Eine „Tinder/Presentation"-Abfolge für Leistungen oder Portfolios — starke räumliche Tiefe.',
  },
  {
    id: 'cinematic-overlay',
    name: 'Cinematic Overlay',
    directive:
      'Kinematische Hero-Sektion: großflächiger Hintergrund (Bild/Verlauf) mit zentriertem Overlay-Text in Letterbox-Bändern (schwarze Balken oben/unten wie 21:9), der beim ersten Scroll langsam ausblendet (parallax + opacity). Setzt einen Film-Vorspann-Ton, danach klassische Sektionen.',
  },
  {
    id: 'mosaic-gallery',
    name: 'Mosaik-Galerie',
    directive:
      'Dichte CSS-grid-Mosaik-Galerie (grid-auto-flow:dense, gemischte row/column-spans) als Haupt-Bereich für Bilder/Projekte/Leistungen. Beim Hover skaliert eine Kachel leicht und hebt sich ab (z-index + scale), die anderen bleiben ruhig. Lebendige, packende Bild-Präsenz.',
  },
];

// ─── AXIS 2 — Motion recipes (grouped; picker takes 2 distinct families) ─

export const MOTION_RECIPES: MotionRecipe[] = [
  // entrance
  {
    id: 'scroll-reveal-fade',
    name: 'Scroll-Reveal Fade-Up',
    family: 'entrance',
    technique:
      'Elemente starten opacity:0; transform:translateY(28px). JS IntersectionObserver fügt Klasse .in zu → CSS transition opacity .6s ease, transform .7s cubic-bezier(.2,.7,.2,1). Staffelung per transition-delay:calc(var(--i)*80ms). Sanftes, gestaffeltes Erscheinen beim Scrollen.',
  },
  {
    id: 'stagger-fade',
    name: 'Stagger-Fade (Listen)',
    family: 'entrance',
    technique:
      'Karten-/Listenkinder erhalten --i Index, beginnen opacity:0; translateY(16px); beim Sichtbarwerden transition-delay:calc(var(--i)*70ms) → werden wellenförmig nacheinander sichtbar. Bringt Rhythmus in jede Auflistung.',
  },
  // ambient
  {
    id: 'animated-gradient',
    name: 'Animierter Verlauf',
    family: 'ambient',
    technique:
      'Hintergrund/Flächen mit linear-gradient(120deg, farbe1, farbe2, farbe1); background-size:200% 200%; @keyframes verschieben background-position 0% 0% → 100% 100% über 14s ease-in-out infinite. Lebendiger, atmender Untergrund ohne Video.',
  },
  {
    id: 'kinetic-typography',
    name: 'Kinetische Typografie',
    family: 'ambient',
    technique:
      'Display-Überschrift: Wörter in <span> wrappen, @keyframes bringen sie nacheinander rein (translateY+rotate+opacity, delay calc(var(--w)*120ms)) ODER clip-path:inset() reveal von unten nach oben. Der Titel „performt" — stark filmisch.',
  },
  // depth
  {
    id: 'parallax-scroll',
    name: 'Parallax-Tiefe',
    family: 'depth',
    technique:
      'Hintergrund-/Deko-Elemente bewegen sich langsamer als der Inhalt: JS scroll-Listener setzt transform:translateY(scrollY*speed) (data-speed 0.2-0.4). Nur transform nutzen (GPU). Erzeugt räumliche Tiefe, mehrere Schichten.',
  },
  // interactive
  {
    id: 'cursor-magnet',
    name: 'Cursor-Magnet',
    family: 'interactive',
    technique:
      'Icons/Bilder/CTA wandern leicht zur Maus: JS mousemove → translate(max ±10px) in Cursor-Richtung, mouseleave → reset mit transition .35s. Subtile, lebendige Reaktion auf den Nutzer — die Seite „atmet" mit.',
  },
  {
    id: 'magnetic-cta',
    name: 'Magnetischer CTA',
    family: 'interactive',
    technique:
      'Haupt-CTA: bei Hover folgt der Button-Inhalt der Maus (translate ±6px), Button skaliert 1.05, Akzent-Glow-Shadow wächst. JS berechnet translate aus Mausposition relativ zur Button-Mitte. Spürbare, hochwertige Interaktion.',
  },
  // text
  {
    id: 'text-gradient-glow',
    name: 'Text-Gradient + Glow',
    family: 'text',
    technique:
      'Display-Titel: background:linear-gradient(Akzent→Farbe2); -webkit-background-clip:text; color:transparent; @keyframes verschieben background-position + text-shadow/drop-shadow Glow in Akzentfarbe (0 0 24px). Leuchtende, animierte Headline — Wow-Moment.',
  },
];

// ─── AXIS 3 — Visual effects (materiality polish) ─────────────────────

export const VISUAL_EFFECTS: VisualEffect[] = [
  {
    id: 'glassmorphism',
    name: 'Glassmorphism',
    technique:
      'Nav-/Karten-Surfaces: background:rgba(255,255,255,.55) (bzw. dark rgba); backdrop-filter:blur(14px) saturate(140%); border:1px solid rgba(255,255,255,.18); dezenter inset-Highlight. Frosted-Glas-Eleganz über Verlaufs-/Bild-Hintergründen.',
  },
  {
    id: 'noise-grain',
    name: 'Film-/Papier-Korn',
    technique:
      'Overlay-DIV (position:fixed; inset:0; pointer-events:none; z-index hoch): background:url("data:image/svg+xml,…feTurbulence…"); opacity:.045; mix-blend-mode:overlay. Gibt dem ganzen Design edles Film-/Papier-Korn — kein steriler Digital-Flatcharakter.',
  },
  {
    id: 'hover-3d',
    name: '3D-Hover-Tilt',
    technique:
      'Karten kippen räumlich bei Hover: perspective auf Eltern-Container, transform:rotateX/rotateY berechnet aus der Mausposition innerhalb der Karte, transform-style:preserve-3d, transition .2s; reset bei mouseleave. Taktile, räumliche Tiefe.',
  },
  {
    id: 'glitch',
    name: 'Subtiler Glitch',
    technique:
      'Hero-Titel: Text zweimal duplizieren (Rot/Cyan-Versatz via text-shadow oder ::before/::after mit clip-path), @keyframes lösen alle ~6s für ~300ms eine kurze Verschiebung aus. Sparsam, nicht dauerhaft — gibt technischen / kanten Charakter.',
  },
  {
    id: 'custom-cursor',
    name: 'Custom-Cursor',
    technique:
      'Eigener Cursor (nur Desktop, pointer:fine): fixeder Kreis background:#fff; mix-blend-mode:difference; folgt der Maus per transform mit leichtem lerp; über Links/CTAs skaliert er. Default-Cursor ausblenden. Ein unterschriebenes, agenturiges Detail.',
  },
  {
    id: 'neon-glow',
    name: 'Neon-Glow',
    technique:
      'Akzent-Elemente (ein Titel, Haupt-CTA, Schlüssel-Icons): box-shadow/text-shadow in der Akzentfarbe mit weichem Spread (0 0 24px), bei Hover intensiver. NUR auf EINEM bis ZWEI Elementen — nicht inflationär. Gibt dramatischen Glow-Akzent.',
  },
];

// ─── Deterministic hashing (local — design-direction's isn't exported) ──

function hash32(s: string): number {
  let h = 2166136261 >>> 0; // FNV-1a offset
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], h: number): T {
  return arr[h % arr.length];
}

/** Choose 2 motions from DIFFERENT families (so they layer, not duplicate). */
function pickTwoMotions(h1: number, h2: number): MotionRecipe[] {
  const first = pick(MOTION_RECIPES, h1);
  // Walk from a different offset until we land on another family.
  let idx = h2 % MOTION_RECIPES.length;
  for (let i = 0; i < MOTION_RECIPES.length; i++) {
    const cand = MOTION_RECIPES[(idx + i) % MOTION_RECIPES.length];
    if (cand.family !== first.family) return [first, cand];
  }
  return [first]; // unreachable (≥2 families exist)
}

/**
 * Deterministically pick a 3-axis creative constellation from a seed string.
 * Same seed ⇒ same axes. Use a per-design seed (topic for agent, name|theme
 * for batch) so designs of the same kind diverge.
 */
export function pickCreativeAxes(seed: string): CreativeAxes {
  const s = seed || 'default';
  const a = hash32('arc:' + s);
  const m1 = hash32('m1:' + s);
  const m2 = hash32('m2:' + s);
  const e = hash32('eff:' + s);
  return {
    archetype: pick(LAYOUT_ARCHETYPES, a),
    motions: pickTwoMotions(m1, m2),
    effect: pick(VISUAL_EFFECTS, e),
  };
}

const REDUCED_MOTION =
  'ZUGÄNGLICHKEIT (bindend): Jede Bewegung MUSS unter @media (prefers-reduced-motion: reduce) deaktiviert oder auf reine opacity-Übergänge reduziert werden — keine Transformationen, kein Parallax, kein Autoplay-Jitter.';

/**
 * Render the axes as an ENFORCED German directive block for the generate
 * prompt. `mode='full'` emits structure + motion + effect (batch + agent
 * backward-compat). `mode='motion-only'` drops the structural gesture so it
 * never fights a concept's explicit layoutApproach (agent concept path).
 */
export function renderCreativeBlock(axes: CreativeAxes, mode: CreativeMode = 'full'): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════',
    'KREATIV-DNA (BINDEND — das macht dieses Design EINZIGARTIG statt austauschbar):',
    '═══════════════════════════════════════════════',
  ];
  if (mode === 'full') {
    lines.push(
      `STRUKTUR-GESTE — ${axes.archetype.name}:`,
      axes.archetype.directive,
    );
  }
  lines.push(
    'BEWEGUNG (MUSS deutlich spürbar sein — das ist das „Leben" / Video-Gefühl):',
    ...axes.motions.map((m) => `  • ${m.name}: ${m.technique}`),
    'EFFEKT (Materialität / Polish):',
    `  • ${axes.effect.name}: ${axes.effect.technique}`,
    REDUCED_MOTION,
    '═══════════════════════════════════════════════',
  );
  return lines.join('\n');
}

/** One-shot convenience: pick + render in one call. */
export function creativeBlockFor(seed: string, mode: CreativeMode = 'full'): string {
  return renderCreativeBlock(pickCreativeAxes(seed), mode);
}

/** Short human label for the agent trace / logs. */
export function axesLabel(axes: CreativeAxes): string {
  return `${axes.archetype.name} · ${axes.motions.map((m) => m.name).join(' + ')} · ${axes.effect.name}`;
}
