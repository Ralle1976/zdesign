// Z.Design — "Critique Theater" panelists
//
// Replaces the single generic critic with SIX focused panelists, each scoring
// ONE dimension. Run in parallel by critic-theater.ts; the weighted composite
// lifts the aesthetic ceiling (designer weighted high = Ausstrahlung matters).
//
// Q4 added the "concept-fidelity" panelist (weight 0.15) — it asks whether the
// rendered HTML actually SERVES the Big Idea, whether the SIGNATURE gesture is
// present, and whether the result reads as defensible agency work rather than a
// template. When no Concept is on the brief it returns a neutral 8/10 so it
// neither punishes the legacy/concept-less path nor inflates the composite.
//
// Ported concept from OpenDesign's apps/daemon/src/critique/ (multi-panelist
// convergence) but rewritten for Z.Design's German art-direction contract.

import { jsonrepair } from 'jsonrepair';
import type { ArtBrief } from './art-direction';

export type PanelistRole = 'designer' | 'critic' | 'brand' | 'a11y' | 'copy' | 'concept-fidelity';

export interface PanelistResult {
  role: PanelistRole;
  score: number; // 0-10
  refinements: string[];
  summary: string;
}

export interface PanelistDef {
  role: PanelistRole;
  weight: number; // sums to 1.0 across PANELISTS
  dimension: string;
  buildPrompt(html: string, brief: ArtBrief): string;
  /**
   * N1 MULTI-MODELL: the Z.ai model this panelist should run on.
   * - designer/critic (heavy aesthetic/brief judgment) → glm-5.2 (full power).
   * - brand/a11y/copy/concept-fidelity (lighter deterministic checks) →
   *   glm-5-turbo (faster, cheaper, higher concurrency headroom — 10×).
   * The theater forwards this to callZai via opts.model.
   */
  preferredModel: string;
}

const SCORE_RULE =
  `Bewerte streng 0–10, keine Höflichkeitspunkte. ≤7 = konkreter Nachbesserungsbedarf.`;
const FORMAT_RULE =
  `Antworte NUR mit rohem JSON (kein Markdown, kein Text davor/danach) genau so:\n` +
  `{"score":0,"summary":"Diagnose auf Deutsch, max 2 Sätze","refinements":["konkrete Maßnahme 1","..."]}\n` +
  `refinements = 2–5 KONKRETE Maßnahmen (z. B. "H1 → Cormorant 600, clamp(40px,6vw,72px)"). Nur was zu ändern ist, kein Lob.`;
/** Cap HTML sent to each panelist — they run 5× in parallel, so this 5×'s the
 *  input savings and avoids empty GLM outputs on heavy prompts. 30KB still covers
 *  a full hero+features for scoring. */
const HTML_CAP = 30000;

const briefLine = (b: ArtBrief): string =>
  `Domain ${b.domain} · Mood ${b.mood} · Akzent ${b.palette.accent} · Display ${b.system.displayFont} · Body ${b.system.bodyFont} (${b.system.label})`;

const designerPrompt = (html: string, brief: ArtBrief): string => [
  `Creative Director — Urteil: ÄSTHETIK & AUSSTRAHLUNG (nur das).`,
  `Prüfe: Komposition, Hierarchie, die „Soul Bar" (Marke/Studio am Screenshot erkennbar?), Atmosphäre (Verlauf/Schatten/Korn/Glow — nicht flach), Zurückhaltung plus EINE mutige Geste, editorialer Charakter.`,
  `Strafe hart: generisch, templatehaft, „Linear/Stripe-Klon", ohne Handschrift.`,
  `Soll: ${briefLine(brief)} · Atmosphäre ${brief.atmosphere}`,
  ``,
  SCORE_RULE,
  FORMAT_RULE,
  ``,
  `ZU BEWERTENDES HTML:`,
  html.slice(0, HTML_CAP),
].join('\n');

const criticPrompt = (html: string, brief: ArtBrief): string => [
  `Brief-Fit-Reviewer — Urteil: ERFÜLLT DIE SEITE DEN NUTZERAUFTRAG, und ist sie LESBAR? (nur das)`,
  `Prüfe: Auftrag erfüllt (Domain/Mood), Kontrast, Schriftgewichte, Lesbarkeit, Hierarchie, keine erfundenen Fakten, keine kaputten/leeren Abschnitte.`,
  `Strafe hart: am Brief vorbei, unleserlich, erfundene Fakten, falsche Sprache.`,
  `Soll: ${briefLine(brief)}`,
  ``,
  SCORE_RULE,
  FORMAT_RULE,
  ``,
  `ZU BEWERTENDES HTML:`,
  html.slice(0, HTML_CAP),
].join('\n');

const brandPrompt = (html: string, brief: ArtBrief): string => [
  `Design-System-Owner — Urteil: TOKEN-DISZIPLIN & ANTI-SLOP (nur das).`,
  `Prüfe: Farben via var(--token) aus :root — kein Literal-Hex außerhalb; Palette eingehalten; kein Indigo/Violett als Akzent; keine Emoji-Icons; keine left-accent-Karten; einheitliche Stimme zum Mood.`,
  `Strafe hart: hardcodierte Hex, off-palette, Slop (Indigo/Purple/Emoji), Markenbruch.`,
  `Soll-Palette: bg ${brief.palette.background} · surface ${brief.palette.surface} · primary ${brief.palette.primary} · accent ${brief.palette.accent} · text ${brief.palette.text} · ${briefLine(brief)}`,
  ``,
  SCORE_RULE,
  FORMAT_RULE,
  ``,
  `ZU BEWERTENDES HTML:`,
  html.slice(0, HTML_CAP),
].join('\n');

const a11yPrompt = (html: string, brief: ArtBrief): string => [
  `Accessibility-Auditor (WCAG 2.1 AA) — Urteil: ZUGÄNGLICHKEIT (nur das).`,
  `Prüfe: Kontrast AA (Text 4.5:1, groß 3:1), sichtbares :focus-visible, Semantik (header/nav/main/section/h1–h3), alt-Texte, prefers-reduced-motion, Touch-Targets ≥44px, keine Deko im Tab-Fokus.`,
  `Strafe hart: fehlender Alt-Text, zu geringer Kontrast, kein Fokus, DIV-Suppe.`,
  `Soll: ${briefLine(brief)}`,
  ``,
  SCORE_RULE,
  FORMAT_RULE,
  ``,
  `ZU BEWERTENDES HTML:`,
  html.slice(0, HTML_CAP),
].join('\n');

const copyPrompt = (html: string, brief: ArtBrief): string => [
  `Text-Chef (Copy & Microcopy, Deutsch) — Urteil: SPRACHE & INHALT (nur das).`,
  `Prüfe: Voice/Ton zum Mood, prägnante Formulierungen, ECHTER kontextueller Inhalt (kein Lorem/Filler/„Feature eins"), CTA-Qualität, korrekte Grammatik/Rechtschreibung/Großschreibung.`,
  `Strafe hart: Lorem ipsum, Platzhalter, nichtssagende CTAs („Mehr"), Grammatikfehler, falsche Sprache.`,
  `Soll: ${briefLine(brief)} — Inhalt muss DEUTSCH und themenpassend sein.`,
  ``,
  SCORE_RULE,
  FORMAT_RULE,
  ``,
  `ZU BEWERTENDES HTML:`,
  html.slice(0, HTML_CAP),
].join('\n');

/**
 * Concept-Fidelity panelist (Q4). Defends the Big Idea — it does NOT score
 * aesthetics or copy, only whether the rendered page SERVES the concept the
 * creative director pitched:
 *   1. Dient dieses Design dem Big Idea?
 *   2. Ist die Signatur-Geste praesent (und konkret umgesetzt, nicht nur behauptet)?
 *   3. Als Agentur-Arbeit erkennbar (defensible pitch, kein Template-Klon)?
 *
 * NEUTRAL FALLBACK: when the brief carries no Concept (legacy / concept-less
 * path) this panelist must NOT influence the composite. We short-circuit by
 * emitting a pre-scored JSON sentinel — parsePanelist turns it into a neutral
 * 8/10 with empty refinements, so it neither rewards nor penalizes. The LLM is
 * not called for the no-concept case (critic-theater still calls callZai, but
 * the sentinel parses deterministically and the model output, if any, is
 * ignored because the sentinel is already valid JSON).
 */
const CONCEPT_NEUTRAL_SCORE = 8;
const CONCEPT_NEUTRAL_SENTINEL = JSON.stringify({
  score: CONCEPT_NEUTRAL_SCORE,
  summary: 'Kein Konzept auf dem Brief — neutrale Bewertung (Q4-Fidelity neutral).',
  refinements: [],
});

const conceptFidelityPrompt = (html: string, brief: ArtBrief): string => {
  const concept = brief.concept;
  // No concept → neutral. Emit the sentinel verbatim; parsePanelist will read
  // score 8 and empty refinements. No HTML context needed.
  if (!concept || !concept.bigIdea || !concept.bigIdea.trim()) {
    return CONCEPT_NEUTRAL_SENTINEL;
  }
  return [
    `Konzept-Fidelity-Juror (Agentur-Perspektive) — Urteil: DIENT DAS DESIGN DEM BIG IDEA? (nur das).`,
    `Du verteidigst das Pitch-Versprechen des Creative Directors, nicht die Ästhetik (das macht der Designer) und nicht den Text (das macht der Copy-Chef).`,
    `Prüfe NUR:`,
    `1. BIG IDEA — Organisiert die Seite erkennbar diesen EINEN Gedanken? Oder ist das Konzept nur Dekoration neben einer generischen Struktur?`,
    `2. SIGNATUR-GESTE — Ist die vereinbarte Geste KONKRET und SICHTBAR im Markup umgesetzt (nicht nur behauptet)? Wo genau? Wenn sie fehlt oder nur angedeutet ist: harter Abzug.`,
    `3. AGENTUR-ERKENNBARKEIT — Würde ein Award-Juror sagen „das ist ein Konzept mit Handschrift", oder ist es ein Template-Klon (Linear/Stripe/Standard-Hero+Features)?`,
    `Strafe hart: Big Idea nicht spürbar, Signatur-Geste fehlend/anders als vereinbart, Layout bricht das Anti-Versprechen, wirkt wie ein generisches Template.`,
    `LOBE NICHT um des Lobens willen — wenn die Geste nur halb umgesetzt ist, heißt das ≤7.`,
    ``,
    `PITCH (vom Creative Director):`,
    `· Konzept: ${concept.name}`,
    `· BIG IDEA: ${concept.bigIdea}`,
    `· Narrativ: ${concept.narrative}`,
    `· SIGNATUR-GESTE (MUSS deutlich präsent sein): ${concept.signatureVisual}`,
    `· Layout-Ansatz: ${concept.layoutApproach}`,
    `· Anti-Template (darf NICHT aussehen wie): ${concept.antiTemplate}`,
    `· Warum Agentur: ${concept.wowAngle}`,
    concept.exemplars?.length ? `· Referenzen: ${concept.exemplars.join(', ')}` : ``,
    ``,
    SCORE_RULE,
    FORMAT_RULE,
    ``,
    `ZU BEWERTENDES HTML:`,
    html.slice(0, HTML_CAP),
  ].filter(Boolean).join('\n');
};

/** N1 model assignment constants. */
export const PANELIST_MODEL_HEAVY = 'glm-5.2'; // designer + critic — full-power judgment
export const PANELIST_MODEL_LIGHT = 'glm-5-turbo'; // brand/a11y/copy/concept — fast, cheap, 10× concurrency

export const PANELISTS: PanelistDef[] = [
  { role: 'designer', weight: 0.25, dimension: 'AESTHETICS & SOUL', buildPrompt: designerPrompt, preferredModel: PANELIST_MODEL_HEAVY },
  { role: 'critic', weight: 0.20, dimension: 'BRIEF FIT & READABILITY', buildPrompt: criticPrompt, preferredModel: PANELIST_MODEL_HEAVY },
  { role: 'brand', weight: 0.15, dimension: 'TOKEN & BRAND COMPLIANCE', buildPrompt: brandPrompt, preferredModel: PANELIST_MODEL_LIGHT },
  { role: 'a11y', weight: 0.15, dimension: 'ACCESSIBILITY', buildPrompt: a11yPrompt, preferredModel: PANELIST_MODEL_LIGHT },
  { role: 'copy', weight: 0.10, dimension: 'COPY & MICROCOPY', buildPrompt: copyPrompt, preferredModel: PANELIST_MODEL_LIGHT },
  { role: 'concept-fidelity', weight: 0.15, dimension: 'CONCEPT FIDELITY (BIG IDEA)', buildPrompt: conceptFidelityPrompt, preferredModel: PANELIST_MODEL_LIGHT },
];

/**
 * Tolerant parse of a panelist's JSON response. Strips markdown fences, runs
 * jsonrepair, clamps score 0-10, defaults refinements to []. Returns null ONLY
 * if nothing parseable is found. Never throws.
 */
export function parsePanelist(role: PanelistRole, raw: string): PanelistResult | null {
  if (!raw || typeof raw !== 'string') return null;
  let text = raw.trim();

  // strip markdown code fences ```json ... ``` or ``` ... ```
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const tryParse = (s: string): Record<string, unknown> | null => {
    try { return JSON.parse(s) as Record<string, unknown>; } catch { /* fall through */ }
    try { return JSON.parse(jsonrepair(s)) as Record<string, unknown>; } catch { return null; }
  };

  let obj = tryParse(text);
  if (!obj) {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]);
  }
  if (!obj) return null;

  const num = (v: unknown): number => {
    const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : 0;
  };

  const score = num(obj.score);

  let refinements: string[] = [];
  const rRaw = obj.refinements;
  if (Array.isArray(rRaw)) {
    refinements = rRaw.map((r) => String(r).trim()).filter(Boolean).slice(0, 6);
  } else if (typeof rRaw === 'string' && rRaw.trim()) {
    refinements = [rRaw.trim()];
  }

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim()
      ? obj.summary.trim().slice(0, 300)
      : '';

  return { role, score, refinements, summary };
}
