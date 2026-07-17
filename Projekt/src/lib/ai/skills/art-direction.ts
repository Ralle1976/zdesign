// Z.Design — "Art Direction" skill
//
// The deterministic brief-builder for the agentic HTML design loop. It seeds from
// the topic-aware `deriveDesignDirection` (palette/fonts/archetype) and expands it
// into a full art-direction brief that DEMANDS the qualities the node-tree output
// lacked: Harmonie, Leben, Ausstrahlung. The brief is fed to the generate/refine
// steps as enforced art direction (same idea as the DesignNode directive, but for
// a rich HTML medium where these qualities are actually expressible).

import { deriveDesignDirection, type DesignDirective } from '../fusion/design-direction';
import { pickSystemForTopic, type DesignSystem } from '@/lib/design-systems/systems';
import { ANTI_SLOP_CRAFT } from '@/lib/ai/lint/anti-slop-craft';
import { ULTRA_QUALITY_BAR } from '@/lib/ai/ultra-quality';
import { getExperiencePrompt } from '@/lib/ai/app-shell';
import type { ExperienceMode } from '@/lib/ai/pipeline-intent';
import type { DesignRecipe } from '@/lib/ai/skills/skill-memory';
import type { Concept } from './creative-director';
import { pickCreativeAxes, renderCreativeBlock, type CreativeAxes } from './creative-diversity';

// ─── Craft-Pflichten (BINDEND — der Vision-Critic prüft EXAKT diese Punkte) ───
// Extracted as a constant so BOTH prompt paths (concept-first + default)
// enforce the same concrete quality rules. These address the 4 recurring
// weaknesses the GLM-5v vision-critic flagged: flat atmosphere, generic
// layout, weak typography hierarchy, basic imagery integration.

const CRAFT_DUTIES = [
  ``,
  `═══ CRAFT-PFLICHTEN (BINDEND — der Vision-Critic prüft EXAKT diese Punkte) ═══`,
  ``,
  `1. ATMOSPHÄRE & TIEFE (NICHT flach!):`,
  `   - HINTERGRUND: KEINE flache Einfarbigkeit. Mindestens EIN subtiler Verlauf (radial-gradient oder linear-gradient mit 5-12% Opazität) auf body ODER hero. Beispiel: background: linear-gradient(180deg, var(--surface) 0%, var(--bg) 100%);`,
  `   - SCHATTEN: Jede Card braucht MEHR als ein flacher Schatten. Nutze GESCHICHTEXTE Schatten: box-shadow: 0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.04);`,
  `   - TEXTUR: Ein SVG-Noise-Overlay (data-URI, opacity 0.03-0.05) auf body für Film-Korn. Beispiel: body::before { content:''; position:fixed; inset:0; background:url("data:image/svg+xml,..."); opacity:0.04; pointer-events:none; z-index:9999; }`,
  `   - GLOW: Ein warmes radial-gradient (Akzentfarbe, 8% Opazität) hinter dem Hero-Heading oder CTA.`,
  ``,
  `2. LAYOUT (NICHT generisch!):`,
  `   - HERO: KEIN zentrierter Text auf flachem Hintergrund. Nutze EINE von: (a) asymmetrisches Split (Bild 60% rechts, Text 40% links mit Versatz), (b) Full-bleed Hintergrundbild mit Overlay-Gradient + Text unten links, (c) Overlapping Card-Look (Text-Block überlappt das Bild um -80px).`,
  `   - SECTION-ÜBERGÄNGE: KEINE harten Kanten zwischen Sektionen. Nutze subtile Farbwechsel (surface → bg) ODER einen diagonalen SVG-Separator ODER negative margin für Überlappung.`,
  `   - FEATURE-GRID: KEIN gleichmäßiges 3-Spalten-Grid. Nutze ein BENTO-Grid (verschiedene Größen: 2fr 1fr 1fr 2fr) oder versetzte Cards mit unterschiedlichem Padding.`,
  `   - WHITESPACE: Sektionen brauchen MINDESTENS 96px vertical padding (mobile 64px). Hero braucht 120-160px.`,
  ``,
  `3. TYPOGRAFIE-HIERARCHIE (KLARE Skala, ATEMRAUM):`,
  `   - SKALA: H1 muss DEUTLICH größer sein als H2 (Faktor 1.5-1.8x). H2 → H3 ebenfalls 1.4x. Nutze clamp() für fluid scaling.`,
  `   - KONTRAST: H1 font-weight 700-800, Body 400. H1 letterSpacing -0.02em bis -0.03em (enger, edel).`,
  `   - ATEMRAUM: H1 braucht margin-bottom von 0.5-0.7em. Absätze brauchen line-height 1.7-1.8 und margin-bottom 1em.`,
  `   - EYEBROW: Über jedem H2 ein kleines Label (12px, uppercase, 0.12em letterSpacing, Akzentfarbe, 600 weight) — das ist die editoriale Geste die es von Template unterscheidet.`,
  `   - DISPLAY-FONT: Die H1 MUSS die Display-Schrift sein (var(--display-font)), nicht die Body-Schrift. Das ist der häufigste Fehler.`,
  ``,
  `4. BILDINTEGRATION (KREATIV, nicht platt):`,
  `   - KEINE naked <img> in einer Card. Stattdessen: (a) Bild als background-image mit Gradient-Overlay, (b) Bild mit border-radius + object-fit:cover + skewed/rotated Transform, (c) Bild als Full-bleed Section-Hintergrund mit Text-Overlay.`,
  `   - BEI Text-auf-Bild: IMMER einen Gradient-Overlay (linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.7) 100%)) damit Text lesbar bleibt.`,
  `   - BILD-ANZAHL: Mindestens 3 thematisch passende Bilder (Hero, Feature-Section, Mood/Stimmung). KEINE Platzhalter-Bilder.`,
  `   - ASPEKTVERHÄLTNIS: Nutze aspect-ratio CSS (z.B. aspect-ratio: 16/9 oder 4/3) für konsistente Bild-Container.`,
].join('\n');

export interface ArtBrief {
  domain: string;
  mood: string;
  rationale: string;
  palette: DesignDirective['palette'];
  fonts: DesignDirective['fonts'];
  archetype: string;
  imagery: string;
  atmosphere: string;
  system: DesignSystem;
  /** Optional learned, approved recipe for this topic (best composite). Injected
   *  by the route after an async loadApprovedRecipeForTopic() call. When present,
   *  generateHtmlPrompt renders it as a strong baseline to start from and elevate. */
  learnedRecipe?: DesignRecipe | null;
  /** Optional LLM-generated creative concept (WOW driver). When present,
   *  generateHtmlPrompt SERVES the concept — it overrides the generic design-system
   *  palette/fonts and injects a prominent KONZEPT block at the very top. */
  concept?: Concept | null;
  /** 3-axis creative constellation (layout gesture + motion + effect) — the
   *  anti-sameness / motion engine. Computed in buildArtBrief; rendered by
   *  generateHtmlPrompt as an ENFORCED directive. When a concept is present only
   *  the motion+effect parts are rendered (motion-only), so it never fights the
   *  concept's own layoutApproach. */
  creative?: CreativeAxes;
  /** App-Shell (view navigation) vs scroll-cinematic. Default: app-shell. */
  experienceMode?: ExperienceMode;
}

/**
 * Build a deterministic, topic-aware art-direction brief. No LLM call — the
 * intelligence is in the curated direction library + the medium-specific
 * imagery/atmosphere guidance below.
 */
/** Merge a Creative-Director concept into the brief (palette/fonts for critic + refine). */
export function applyConceptToBrief(brief: ArtBrief, concept: Concept): ArtBrief {
  return {
    ...brief,
    concept,
    palette: {
      ...brief.palette,
      background: concept.palette.bg,
      surface: concept.palette.surface,
      primary: concept.palette.primary,
      accent: concept.palette.accent,
      text: concept.palette.text,
      textMuted: concept.palette.textMuted,
      border: concept.palette.border,
    },
    fonts: {
      display: concept.fonts.display,
      body: concept.fonts.body,
    },
  };
}

export function buildArtBrief(message: string): ArtBrief {
  const d = deriveDesignDirection(message);
  return {
    domain: d.domain,
    mood: d.mood,
    rationale: d.rationale,
    palette: d.palette,
    fonts: d.fonts,
    archetype: d.archetype,
    imagery: imageryGuidance(d.domain),
    atmosphere: atmosphereGuidance(d.domain),
    system: pickSystemForTopic(message),
    creative: pickCreativeAxes(message),
  };
}

/** Curated Unsplash URLs for post-processing image injection. */
export function getCuratedImageUrls(domain: string): string[] {
  const text = imageryGuidance(domain);
  return [...text.matchAll(/https:\/\/images\.unsplash\.com\/[^\s\n]+/g)].map((m) => m[0]);
}

function imageryGuidance(domain: string): string {
  const U = 'https://images.unsplash.com/';
  const F = '?auto=format&fit=crop&w=1200&q=80';
  // FIX: check health/fitness BEFORE spa/wellness — the domain string
  // "health-fitness-wellness" contains "wellness" but should NOT get spa images.
  if (domain.includes('health') || domain.includes('fitness') || domain.includes('yoga')) {
    return `Yoga/Fitness-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1544367567-0f2fcb009e0b${F}\n${U}photo-1593810451137-5dc55105dace${F}\n${U}photo-1575052814086-f385e2e2ad1b${F}\n${U}photo-1518611012118-696072aa579a${F}\n${U}photo-1545205597-3d9d02c29597${F}`;
  }
  if (domain.includes('spa')) {
    return `Echte Spa-Fotografie. VERWENDE NUR diese Unsplash-URLs als <img src> (mit object-fit:cover):\n${U}photo-1544161515-4ab6ce6db874${F}\n${U}photo-1540555700478-4be289fbecef${F}\n${U}photo-1600334089648-b0d9d3028eb2${F}\n${U}photo-1583847268964-b28dc8f51f92${F}\n${U}photo-1547058736-af8d4b1c1f2e${F}`;
  }
  if (domain.includes('food') || domain.includes('coffee')) {
    return `Echte Food-Fotografie. VERWENDE NUR diese Unsplash-URLs als <img src>:\n${U}photo-1574071318508-1cdbab80d002${F}\n${U}photo-1595708684082-a173bb3a06c5${F}\n${U}photo-1565299624946-b28f40a0ae38${F}\n${U}photo-1546069901-ba9599a7e63c${F}\n${U}photo-1551782450-a2132b4ba21d${F}`;
  }
  if (domain.includes('fashion') || domain.includes('beauty') || domain.includes('parfum')) {
    return `Edle Beauty/Parfum-Fotografie. VERWENDE NUR diese Unsplash-URLs als <img src> (object-fit:cover, alt-Text Pflicht):\n${U}photo-1541643600914-78b084683601${F}\n${U}photo-1592945403244-b3fbafd7f539${F}\n${U}photo-1596462502278-27bfdc403348${F}\n${U}photo-1571781926291-c477ebfd024b${F}\n${U}photo-1615634260162-c4d3e62f2b62${F}`;
  }
  if (domain.includes('portfolio') || domain.includes('creative') || domain.includes('architect')) {
    return `Architektur-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1503387762-592deb58ef4e${F}\n${U}photo-1486718448742-163732cd1544${F}\n${U}photo-1545239351-ef35f43d514b${F}\n${U}photo-1497366216548-37526070297c${F}\n${U}photo-1486325212027-8081e485255e${F}`;
  }
  if (domain.includes('crypto') || domain.includes('web3')) {
    return `Crypto/Tech-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1551288049-bebda4e38f71${F}\n${U}photo-1460925895917-afdab827c52f${F}\n${U}photo-1551434678-e076c223a692${F}\n${U}photo-1518186285589-2f7649de83e0${F}\n${U}photo-1639762681485-074b4f938ba6${F}`;
  }
  if (domain.includes('music') || domain.includes('festival') || domain.includes('nightlife')) {
    return `Festival/Music-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1514525253161-7a46d19cd819${F}\n${U}photo-1470225620780-dba8ba36b745${F}\n${U}photo-1506157786151-b8491531f063${F}\n${U}photo-1493225457124-a3eb161ffa5f${F}\n${U}photo-1501386761578-eac5c94b800a${F}`;
  }
  if (domain.includes('travel') || domain.includes('nature') || domain.includes('outdoor')) {
    return `Berg/Natur-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1464822759023-fed622ff2c3b${F}\n${U}photo-1469474968028-56623f02e42e${F}\n${U}photo-1454496522488-9855808a1415${F}\n${U}photo-1483728642387-6c3bdd6c93e5${F}\n${U}photo-1506905925346-21bda4d32df4${F}`;
  }
  if (domain.includes('law') || domain.includes('finance') || domain.includes('corporate')) {
    return `Kanzlei/Corporate-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1589829545856-d10d557cf95f${F}\n${U}photo-1497366811353-6870744d04b2${F}\n${U}photo-1497366754035-f200968a6e72${F}\n${U}photo-1521587760476-6c12a4b040da${F}`;
  }
  if (domain.includes('saas') || domain.includes('analytics')) {
    return `SaaS/Analytics-Fotografie. VERWENDE NUR diese Unsplash-URLs:\n${U}photo-1551288049-bebda4e38f71${F}\n${U}photo-1460925895917-afdab827c52f${F}\n${U}photo-1551434678-e076c223a692${F}\n${U}photo-1518186285589-2f7649de83e0${F}`;
  }
  return `Themengerechte Fotografie von Unsplash (nur diese URLs, keine MiniMax/AI-Bilder):\n${U}photo-1497366754035-f200968a6e72${F}\n${U}photo-1545239351-ef35f43d514b${F}\n${U}photo-1469474968028-56623f02e42e${F}`;
}

function atmosphereGuidance(_domain: string): string {
  return 'Atmosphäre & Tiefe durch CSS: geschichtete weiche Schatten, subtiler Farbverlauf (radial/linear) statt flacher Flächen, ein hauchzartes Papier-/Film-Korn (SVG-Noise als data-URI background, opacity ~0.04), warme Glow-Lichter, organische dekorative Linien (z. B. thematische Silhouette als Inline-SVG).';
}

/**
 * Compact human label for the agent trace UI ("asian-spa-thai-wellness — seren · warm").
 */
export function briefLabel(b: ArtBrief): string {
  return `${b.domain} — ${b.mood}`;
}

/**
 * The MASTER prompt for the GENERATE step: produce a complete, self-contained,
 * art-directed HTML document from the brief + user request. This is where the
 * "Harmonie/Leben/Ausstrahlung" requirements are enforced as concrete, checkable
 * craft instructions (the critique step scores exactly these).
 */
export function generateHtmlPrompt(brief: ArtBrief, message: string, existingHtml?: string): string {
  const experienceBlock = getExperiencePrompt(brief.experienceMode ?? 'app-shell');
  const sys = brief.system;
  const recipe = brief.learnedRecipe;
  const recipeBlock = recipe
    ? [
        `BEWÄHRTE BASIS (Ø${recipe.sourceComposite} Entwurf für dieses Thema — übertreffe sie, kopiere nicht):`,
        `Palette ${Object.entries(recipe.palette).map(([k, v]) => `${k} ${v}`).join(' · ')} · Display "${recipe.fonts.display}" / Body "${recipe.fonts.body}" · Archetyp ${recipe.layoutArchetype}`,
        recipe.soulGestures?.length ? `Siegreiche Gesten: ${recipe.soulGestures.join(' · ')}` : ``,
        recipe.praisedByPanelists?.length ? `Gelobt: ${recipe.praisedByPanelists.join(' · ')}` : ``,
        recipe.avoidPatterns?.length ? `Vermeiden: ${recipe.avoidPatterns.join(' · ')}` : ``,
      ].filter(Boolean).join('\n') + '\n'
    : ``;

  // ---- CONCEPT-FIRST OVERRIDE (WOW driver) ----
  // When a Concept is present, the CONCEPT palette/fonts REPLACE the generic
  // design-system :root ENTIRELY — the system :root (sys.rootCss) is NOT
  // injected here at all. The concept palette is the ONLY :root block the model
  // receives; the design-system is demoted to a reference-only role. This is the
  // Q1 fix: previously both roots leaked into the trace and the model reverted to
  // the (generic) system one, making every "varied" concept look identical.
  const concept = brief.concept;
  // KREATIV-DNA (anti-sameness + motion): rendered as an enforced directive.
  // When a concept supplies its own layoutApproach we emit motion+effect only
  // so the structural gesture never contradicts the concept.
  const creativeBlock = brief.creative
    ? '\n' + renderCreativeBlock(brief.creative, concept ? 'motion-only' : 'full') + '\n'
    : '';
  if (concept) {
    const cp = concept.palette;
    const cf = concept.fonts;
    const conceptFontsHref = cf.googleFontsHref
      ? ` Lade sie via <link href="${cf.googleFontsHref}"> im <head> VOR dem <style>.`
      : ` Lade sie via Google Fonts <link> im <head> VOR dem <style>.`;
    // The SINGLE :root the model is allowed to use — built ONLY from the concept.
    const conceptRootCss = [
      `:root {`,
      `  --bg: ${cp.bg};`,
      `  --surface: ${cp.surface};`,
      `  --primary: ${cp.primary};`,
      `  --accent: ${cp.accent};`,
      `  --text: ${cp.text};`,
      `  --text-muted: ${cp.textMuted};`,
      `  --border: ${cp.border};`,
      `}`,
    ].join('\n');
    const motionLine = concept.motion ? `\nBEWEGUNG (Motion als Teil der Inszenierung): ${concept.motion}` : ``;
    return [
      `Du bist Art Director UND Senior-Frontend-Engineer. EINE vollständige HTML-Datei: HTML5 + inline <style> + <script>. CDN-Libraries via <script src> erlaubt (GSAP, vanilla JS). Kein npm/Build-Schritt.`,
      ``,
      `═══════════════════════════════════════════════════════════════`,
      `KONZEPT: ${concept.name} — BIG IDEA: ${concept.bigIdea}.`,
      `Narrativ (die Wirbelsäule): ${concept.narrative}`,
      `SIGNATUR-GESTE (MUSS im Design deutlich präsent sein — das ist der WOW): ${concept.signatureVisual}`,
      `Layout-Ansatz (BRECHE die generische Template-Struktur zugunsten des Konzepts): ${concept.layoutApproach}`,
      `Anti-Template: ${concept.antiTemplate}`,
      `Warum Agentur-Niveau: ${concept.wowAngle}`,
      `═══════════════════════════════════════════════════════════════`,
      ``,
      `Dieses Design DIENiT DEM BIG IDEA. Es ist KEINE generische ${brief.domain}-Landingpage — es ist eine kreative Inszenierung. Wenn ein Betrachter es screenshotet und „Agentur-Arbeit" vermutet, hast du es richtig gemacht.`,
      ``,
      `PALETTE & SCHRIFT — DIESES IST DEINE EINZIGE PALETTE (BINDEND, DOMINANT):`,
      `Deine Palette ist: bg ${cp.bg} · surface ${cp.surface} · primary ${cp.primary} · Akzent ${cp.accent} · text ${cp.text} · textMuted ${cp.textMuted} · border ${cp.border}. VERWENDE NUR diese Farben. Das Design-System ist NUR REFERENZ (Struktur/Handwerk), aber die KONZEPT-PALETTE DOMINIERT. Injiziere KEIN anderes :root, KEINE anderen Hex-Werte. Token-Liste unten ist das EINZIGE :root, das im <style> stehen darf.`,
      `Kopiere diesen :root-Block 1:1 als ERSTES ins <style>, referenziere ALLES via var(--token). Kein Hex-Wert außerhalb von :root.`,
      conceptRootCss,
      `Schriften: Display "${cf.display}" · Body "${cf.body}" — NUR diese beiden.${conceptFontsHref}`,
      recipeBlock,
      `ART DIRECTION (dem Konzept untergeordnet):`,
      `Domain ${brief.domain} · Mood ${brief.mood} · Archetyp ${brief.archetype}.`,
      `Warum (System-Fallback, nur Auffüllung): ${brief.rationale}`,
      `Typografie: große atmende Skala via clamp(), klare H1>H2>H3-Hierarchie, leicht negativer Letter-Spacing bei Display. Display = "${cf.display}", Body = "${cf.body}".`,
      `Bildwelt: ${brief.imagery}`,
      `Atmosphäre: ${brief.atmosphere}${motionLine}`,
      creativeBlock,
      `DREI QUALITÄTEN (müssen spürbar sein — das ist die Prüfkriterien):`,
      `HARMONIE — ein tragender Grundton, durchgängiger Rhythmus, 8px-Raster, großzügiger Atem; nichts beißt sich.`,
      `LEBEN — echte Atmosphäre (Verlauf/Schatten/Korn/Glow), echte Bildwelt, sanfte Bewegung (Hover, gestaffeltes Fade-in). Nicht flach.`,
      `AUSSTRAHLUNG — ein konsequenter Mood, Lichtführung, EINE Geste die im Gedächtnis bleibt (die SIGNATUR-GESTE); Zurückhaltung plus ein mutiger Akzent. Editorial, nicht Template.`,
      CRAFT_DUTIES,
      ``,
      experienceBlock,
      ``,
      ULTRA_QUALITY_BAR,
      ``,
      ANTI_SLOP_CRAFT,
      ``,
      `BILDER-PFLICHT (BINDEND): Mindestens 4 echte <img> — NUR frisch generierte URLs aus dem Prompt (kein Unsplash). Einheitliche Farbgebung (Palette ${cp.bg}/${cp.accent}). figure/img mit object-fit:cover, Gradient-Overlay bei Text auf Bild.`,
      `TECHNIK: Mobile-first responsive. Semantisches HTML, alt-Texte, prefers-reduced-motion. Inline-SVG für Deko, keine Emoji-Icons.`,
      `VOLLSTÄNDIGKEIT (BINDEND): VOLLSTÄNDIGE Datei mit </body></html>. Wenn Platz knapp wird: redundantes CSS kürzen — NIEMALS <img>-Tags, <script>-Blöcke, Interaktionen oder Schluss-Tags weglassen. Das schließende </html> MUSS das letzte Element sein.`,
      existingHtml ? `VORHANDENES HTML (behalte Struktur, hebe Ausführung/Atmosphäre an):\n${existingHtml.slice(0, 6000)}\n` : ``,
      ``,
      `NUTZERAUFTRAG:`,
      message,
      ``,
      `Antworte NUR mit der vollständigen HTML-Datei, beginnend mit <!doctype html>. Kein Markdown, kein Kommentar, kein Wort davor oder danach.`,
    ].join('\n');
  }

  // ---- BACKWARD-COMPAT PATH (no concept — behaves exactly as before) ----
  const p = brief.palette;
  const fontsHref = sys.googleFontsHref
    ? ` Schriften via <link href="${sys.googleFontsHref}"> im <head> VOR dem <style>.`
    : ` Schriften via Google Fonts <link> im <head>.`;
  return [
    `Du bist Art Director UND Senior-Frontend-Engineer. EINE vollständige HTML-Datei: HTML5 + inline <style> + <script>. CDN-Libraries via <script src> erlaubt (GSAP, vanilla JS). Kein npm/Build-Schritt.`,
    ``,
    `DESIGN-SYSTEM: ${sys.label} — TOKENS BINDEND.`,
    `Kopiere diesen :root-Block 1:1 als ERSTES ins <style>, referenziere ALLES via var(--token). Kein Hex-Wert außerhalb von :root.`,
    sys.rootCss,
    `Schriften: Display "${sys.displayFont}" · Body "${sys.bodyFont}".${fontsHref}`,
    `Handwerk: ${sys.craftNotes}`,
    recipeBlock,
    `ART DIRECTION:`,
    `Domain ${brief.domain} · Mood ${brief.mood} · Archetyp ${brief.archetype}.`,
    `Warum: ${brief.rationale}`,
    `Palette (nur diese Farben als Token): bg ${p.background} · surface ${p.surface} · primary ${p.primary} · Akzent ${p.accent} (EINE vivide Farbe, sparsam)${p.secondary ? ` · sekundär ${p.secondary} (sehr selten)` : ''} · text ${p.text} · textMuted ${p.textMuted} · border ${p.border}.`,
    `Typografie: große atmende Skala via clamp(), klare H1>H2>H3-Hierarchie, leicht negativer Letter-Spacing bei Display.`,
    `Bildwelt: ${brief.imagery}`,
    `Atmosphäre: ${brief.atmosphere}`,
    creativeBlock,
    ``,
    `DREI QUALITÄTEN (müssen spürbar sein — das ist die Prüfkriterien):`,
    `HARMONIE — ein tragender Grundton, durchgängiger Rhythmus, 8px-Raster, großzügiger Atem; nichts beißt sich.`,
    `LEBEN — echte Atmosphäre (Verlauf/Schatten/Korn/Glow), echte Bildwelt, sanfte Bewegung (Hover, gestaffeltes Fade-in). Nicht flach.`,
    `AUSSTRAHLUNG — ein konsequenter Mood, Lichtführung, EINE Geste die im Gedächtnis bleibt; Zurückhaltung plus ein mutiger Akzent. Editorial, nicht Template.`,
    CRAFT_DUTIES,
    ``,
    experienceBlock,
    ``,
    ULTRA_QUALITY_BAR,
    ``,
    ANTI_SLOP_CRAFT,
    ``,
    `BILDER-PFLICHT: Mindestens 4 <img> — frisch generierte Fotos, KEIN Unsplash/Stock. Palette ${p.background}/${p.accent}, gleiche Lichtstimmung.`,
    `TECHNIK: Mobile-first responsive. Semantisches HTML, alt-Texte, prefers-reduced-motion. Inline-SVG für Deko, keine Emoji-Icons.`,
    `VOLLSTÄNDIGKEIT (BINDEND): VOLLSTÄNDIGE Datei mit </body></html>. Wenn Platz knapp wird: redundantes CSS kürzen — NIEMALS <img>-Tags, <script>-Blöcke, Interaktionen oder Schluss-Tags weglassen. Letzter Token: </html>.`,
    existingHtml ? `VORHANDENES HTML (behalte Struktur, hebe Ausführung/Atmosphäre an):\n${existingHtml.slice(0, 6000)}\n` : ``,
    ``,
    `NUTZERAUFTRAG:`,
    message,
    ``,
    `Antworte NUR mit der vollständigen HTML-Datei, beginnend mit <!doctype html>. Kein Markdown, kein Kommentar, kein Wort davor oder danach.`,
  ].join('\n');
}
