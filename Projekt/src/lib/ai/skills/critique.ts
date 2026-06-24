// Z.Design — "Critique" skill
//
// The critic in the agentic loop. Given the current HTML + the art-direction
// brief, it scores the THREE qualities (Harmonie/Leben/Ausstrahlung) plus
// hierarchy & craftsmanship, and returns SPECIFIC, actionable refinements.
// The refine step applies exactly these. This is the iteration that single-shot
// generation lacks — it's what makes the loop "agentic".

import { jsonrepair } from 'jsonrepair';
import type { ArtBrief } from './art-direction';

export interface Critique {
  scores: {
    harmony: number; // 0-10
    life: number;
    radiance: number;
    hierarchy: number;
    craftsmanship: number;
  };
  overall: number;
  satisfied: boolean;
  refinements: string[];
  summary: string;
}

export function critiquePrompt(html: string, brief: ArtBrief): string {
  return [
    `Du bist ein gestrenger, geschmackssicherer Art Director. Bewerte das folgende HTML streng gegen die Art-Direction und die DREI QUALITÄTEN.`,
    ``,
    `=== ART DIRECTION (Soll-Zustand) ===`,
    `Domain: ${brief.domain} · Mood: ${brief.mood} · Akzent: ${brief.palette.accent} · Fonts: ${brief.fonts.display} / ${brief.fonts.body}`,
    `Bildwelt: ${brief.imagery}`,
    ``,
    `=== DIE DREI QUALITÄTEN (jede 0–10 bewerten) ===`,
    `• harmony (Harmonie): tragender Grundton, typografischer Rhythmus, Proportion, Weißraum, nichts beißt sich.`,
    `• life (Leben): echte Atmosphäre (Verlauf/Schatten/Korn/Glow), echte Bildwelt, organische Details, Bewegung — nicht flach/steril.`,
    `• radiance (Ausstrahlung): konsequenter Mood, Lichtführung, eine unverwechselbare Geste, Zurückhaltung + ein mutiger Akzent — editorial, nicht Template.`,
    `• hierarchy (0–10): klare visuelle Hierarchie, Führung des Blicks, lesbarer Rhythmus.`,
    `• craftsmanship (0–10): sauberes CSS, Konsistenz, Responsive, Barrierearmut, keine kaputten Details.`,
    ``,
    `Sei kritisch. Vergib keine Höflichkeitspunkte. Alles ≤7 braucht konkrete Verbesserung.`,
    ``,
    `Antworte NUR mit rohem JSON (kein Markdown, kein Text davor) genau in dieser Form:`,
    `{"scores":{"harmony":0,"life":0,"radiance":0,"hierarchy":0,"craftsmanship":0},"overall":0,"satisfied":false,"summary":"kurze Diagnose auf Deutsch","refinements":["konkrete, umsetzbare Einzelmaßnahme 1","...","..."]}`,
    `overall = Durchschnitt der fünf Scores (eine Nachkommastelle). satisfied = true nur wenn overall >= 8.5 UND kein Score < 8. refinements = 3–6 KONKRETE, umsetzbare Maßnahmen (z. B. "Hero-Überschrift auf Cormorant 600 statt System-Sans, Größe clamp(40px,6vw,72px)", "goldenen Akzent nur auf CTAs + Eyebrows reduzieren, nicht auf 4 Stellen", "echtes Spa-Foto im Hero statt Farbverlaufs-Platzhalter"). Kein Lob, nur was zu ändern ist.`,
    ``,
    `=== ZU BEWERTENDES HTML ===`,
    html.slice(0, 50000),
  ].join('\n');
}

/**
 * Parse the critic's JSON response. Tolerant (jsonrepair) because the model
 * occasionally wraps/malforms JSON. Returns null only if nothing parses.
 */
export function parseCritique(raw: string): Critique | null {
  const text = raw.trim();
  const tryParse = (s: string): unknown | null => {
    try { return JSON.parse(s); } catch { /* fall through */ }
    try { return JSON.parse(jsonrepair(s)); } catch { return null; }
  };
  let obj = tryParse(text) as Record<string, unknown> | null;
  if (!obj) {
    // extract first {...} block
    const m = text.match(/\{[\s\S]*\}/);
    if (m) obj = tryParse(m[0]) as Record<string, unknown> | null;
  }
  if (!obj) return null;

  const sc = (obj.scores as Record<string, number>) || {};
  const num = (v: unknown, d = 0) => (typeof v === 'number' && !Number.isNaN(v) ? v : d);
  const scores = {
    harmony: num(sc.harmony),
    life: num(sc.life),
    radiance: num(sc.radiance),
    hierarchy: num(sc.hierarchy),
    craftsmanship: num(sc.craftsmanship),
  };
  const vals = Object.values(scores);
  const overall = num(obj.overall, vals.reduce((a, b) => a + b, 0) / (vals.length || 1));
  const refinementsRaw = obj.refinements;
  const refinements = Array.isArray(refinementsRaw)
    ? refinementsRaw.map((r) => String(r)).filter(Boolean).slice(0, 8)
    : typeof refinementsRaw === 'string'
      ? [refinementsRaw]
      : [];
  const minScore = Math.min(...vals);
  return {
    scores,
    overall: Math.round(overall * 10) / 10,
    satisfied: typeof obj.satisfied === 'boolean' ? obj.satisfied : overall >= 8.5 && minScore >= 8,
    refinements,
    summary: typeof obj.summary === 'string' ? obj.summary.slice(0, 300) : '',
  };
}
