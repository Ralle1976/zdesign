// Z.Design — "Creative Director" skill (WOW LAYER)
//
// The missing agency brain: turn a brief into BOLD, CONCEPT-DRIVEN creative
// directions — not moods/palettes. Each Concept is a distinct pitch an art
// director would defend in front of a client: a Big Idea, a SIGNATURE visual
// gesture, a concrete anti-template move, a real palette + Google-Fonts
// pairing, and the "why an agency would pitch it" wowAngle.
//
// The Concepts feed downstream `generateHtmlPrompt` (art-direction.ts), which
// SERVES the concept when present — overriding the generic system tokens with
// the concept's palette/fonts and forcing the Big Idea + signature gesture.
//
// Pure dependency injection: the model `call` fn is passed in (callZai in prod,
// stubs in tests). No Fusion/Z.ai import here — that keeps it testable and
// matches the critic-theater / panelists convention.

import { jsonrepair } from 'jsonrepair';

/**
 * A single creative direction — a defensible pitch, not a moodboard.
 * The palette/fonts shapes mirror DesignDirective so they can override the
 * generic system tokens 1:1 inside generateHtmlPrompt.
 */
export interface Concept {
  /** Short evocative concept name, e.g. "Das Ritual" / "Bangkok bei Nacht". */
  name: string;
  /** The one-sentence Big Idea that organizes the whole page. */
  bigIdea: string;
  /** The narrative spine — how the page reads as a story. */
  narrative: string;
  /** THE distinctive visual move that delivers the WOW (concrete + buildable). */
  signatureVisual: string;
  /** How the layout is structured to serve the Big Idea. */
  layoutApproach: string;
  /** Concept palette — OVERRIDES the generic system tokens. */
  palette: {
    bg: string;
    surface: string;
    primary: string;
    accent: string;
    text: string;
    textMuted: string;
    border: string;
  };
  /** Concept font pairing — OVERRIDES the generic display/body. */
  fonts: {
    display: string;
    body: string;
    /** Optional ready-to-use Google Fonts <link> href. */
    googleFontsHref?: string;
  };
  /** Optional motion / interaction direction. */
  motion?: string;
  /** What generic template structure this concept deliberately BREAKS. */
  antiTemplate: string;
  /** Why an agency would pitch this — the defensibility / wow rationale. */
  wowAngle: string;
  /** Named design references (real websites/studios/aesthetics) to channel. */
  exemplars?: string[];
}

/** Signature of the injected model caller — matches callZai. */
type CallFn = (
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number },
) => Promise<string>;

/**
 * Build the Creative-Director system+user prompt (German). DEMANDS agency-level,
 * BOLD, DISTINCT concepts — each a different creative direction, never 3
 * variants of the same idea. The caliber anchors are EXAMPLES of the expected
 * level only; the model MUST invent its own, never echo them.
 */
function buildDirectorPrompt(briefSummary: string, userMessage: string, count: number): string {
  const anchors = [
    '„Das Ritual" — die Behandlung als 5-Phasen-Scroll-Erzählung, jede Phase ein sinnliches Kapitel, Tusche-Lotus-Motiv als roter Faden',
    '„Bangkok bei Nacht" — Neon-Markt-Energie trifft Tempel-Ruhe, Magenta + Gold auf warmem Schwarz, brutale Typo, kinematografische Bildsprache',
    '„Tempel-Stille" — radikale Reduktion, ein einziger Tuschestrich als Hero, enormer Weißraum, fast monochrom, atemberaubend leise',
  ];
  return [
    `Du bist KREATIVDIREKTOR einer preisgekrönten Design-Agentur. Du erfindest KEINE Moodboards und KEINE Farbpaletten — du erfindest KONZEPTE. Jedes Konzept ist eine eigene, mutige kreative Richtung, die ein Art-Director vor einem Kunden verteidigen würde.`,
    ``,
    `KURZBRIEF: ${briefSummary}`,
    `NUTZERAUFTRAG: ${userMessage}`,
    ``,
    `DEIN AUFTRAG: Erfinde ${count} KONZEPTE. Jedes MUSS eine ANDERE kreative Richtung sein — NICHT drei Varianten desselben Grundgedankens (z. B. nicht drei Spa-Stimmungen, sondern drei völlig verschiedene Sichtweisen auf dasselbe Thema). Wenn das Thema ein Spa ist, dürfen die Konzepte ein Ritual, eine Stadt-Nacht, eine radikale Stille, ein Botanik-Labor, eine Zeremonie … sein.`,
    ``,
    `NIVEAU (Beispiele für die ERWARTETE Qualität — erfinde EIGENE, übernimm diese NIEMALS wörtlich):`,
    ...anchors.map((a) => `  · ${a}`),
    ``,
    `JEDES KONZPT MUSS ENTHALTEN:`,
    `  · name — ein kurzer, evokativer Konzeptname (Eigenname, kein Adjektiv)`,
    `  · bigIdea — EIN Satz, der die zentrale Idee fasst (organisiert die ganze Seite)`,
    `  · narrative — wie sich die Seite als Geschichte liest (Spannungsbogen)`,
    `  · signatureVisual — DIE eine unverwechselbare visuelle Geste, die den WOW-Moment liefert (konkret und in CSS/HTML umsetzbar, z. B. "ein einziger Tuschestrich als Hero, der sich beim Scrollen zu einem Lotus öffnet" — nicht "schöne Bilder")`,
    `  · layoutApproach — wie der Layout-Aufbau der bigIdea dient (brich die Standard-Hero/Features/Preise/CTA-Schablone)`,
    `  · palette — EINE mutige Palette als Objekt {bg, surface, primary, accent, text, textMuted, border} mit echten Hex-Werten; eine vivide Akzentfarbe, sparsam; KEIN generisches Weiß-auf-Blau`,
    `  · fonts — {display, body, googleFontsHref} mit ECHTEM Font-Pairing; googleFontsHref ist der fertige <link>-Href von fonts.googleapis.com (z. B. "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Mulish:wght@400;600&display=swap"); display & body müssen zum Konzept passen`,
    `  · motion (optional) — eine konkrete Bewegungs-/Interaktionsrichtung`,
    `  · antiTemplate — welche generische Template-Struktur dieses Konzept BEWUSST bricht`,
    `  · wowAngle — warum eine Agentur GENAU DAS pitchen würde (die Verteidigung)`,
    `  · exemplars — Array von 2-3 benannten Design-Exemplaren (echte Websites, Studios oder Aesthetiken als Referenz), z. B. ["Aesop.com", "Bureau Borsche", "Bauhaus-Plakatkunst"]`,
    ``,
    `Fuer JEDES Konzept: nenne 2-3 Design-Exemplare (benannte Referenzen — echte Websites/Studios/Aesthetiken). Diese Exemplare geben dem Modell einen KONKRETEN visuellen Anker.`,
    ``,
    `HÄRTETEST (selbst prüfen, bevor du antwortest): Würde ein Award-Juror sagen "das ist ein Konzept, kein Template"? Wenn nein, schärfer nach. signatureVisual darf nicht "hochwertige Bilder" oder "sanfte Animationen" sein — es muss DIE Geste sein.`,
    ``,
    `ANTWORT: NUR ein JSON-Array mit genau ${count} Konzept-Objekten. KEIN Markdown, KEIN Code-Fence, KEIN Einleitungstext, KEIN Schlüsselwort davor. Beginne direkt mit [ und ende mit ].`,
  ].join('\n');
}

/** Validate that a parsed object has the load-bearing Concept fields. */
function isValidConcept(o: unknown): o is Concept {
  if (!o || typeof o !== 'object') return false;
  const c = o as Record<string, unknown>;
  return (
    typeof c.name === 'string' && c.name.trim().length > 0 &&
    typeof c.bigIdea === 'string' && c.bigIdea.trim().length > 0 &&
    typeof c.signatureVisual === 'string' && c.signatureVisual.trim().length > 0 &&
    c.palette !== null && typeof c.palette === 'object' &&
    c.fonts !== null && typeof c.fonts === 'object'
  );
}

/**
 * Generate `count` (default 3) bold, distinct Concepts for a brief.
 *
 * Flow: Creative-Director prompt → call(prompt, {maxTokens:3000, temperature:0.9})
 * → jsonrepair → validate → Concept[].
 *
 * NEVER throws: on any failure (network, parse, empty) it returns []. Callers
 * treat an empty array as "no concept available" and fall back to the
 * deterministic brief (generateHtmlPrompt keeps working without a concept).
 */
export async function generateConcepts(
  briefSummary: string,
  userMessage: string,
  call: CallFn,
  count: number = 3,
): Promise<Concept[]> {
  try {
    if (count < 1) count = 1;
    const prompt = buildDirectorPrompt(briefSummary, userMessage, count);
    const raw = await call(prompt, { maxTokens: 3000, temperature: 0.9 });
    if (!raw || !raw.trim()) return [];

    // Strip accidental markdown fences / preamble before jsonrepair.
    let txt = raw.trim();
    const firstBracket = txt.indexOf('[');
    const lastBracket = txt.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      txt = txt.slice(firstBracket, lastBracket + 1);
    }

    const parsed = jsonrepair(txt);
    const arr = JSON.parse(parsed);
    if (!Array.isArray(arr)) return [];

    const concepts: Concept[] = [];
    for (const item of arr) {
      if (isValidConcept(item)) {
        const c = item as Concept;
        // Normalize exemplars to string[] (default []); tolerate a single string.
        const rawEx = (item as unknown as Record<string, unknown>).exemplars;
        if (Array.isArray(rawEx)) {
          c.exemplars = rawEx.filter((x) => typeof x === 'string' && x.trim().length > 0);
        } else if (typeof rawEx === 'string' && rawEx.trim().length > 0) {
          c.exemplars = [rawEx.trim()];
        } else {
          c.exemplars = [];
        }
        concepts.push(c);
      }
    }
    return concepts;
  } catch (e) {
    console.warn('[creative-director] generateConcepts failed:', e instanceof Error ? e.message : e);
    return [];
  }
}
