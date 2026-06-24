// Z.Design — "Refine" skill
//
// The refine step in the agentic loop. Takes the current HTML + the critic's
// specific refinements + the brief, and returns the FULL revised HTML with the
// refinements applied. Biased toward raising Harmonie/Leben/Ausstrahlung without
// throwing away what works.
//
// RELIABILITY NOTE: we do NOT re-embed the full current HTML (was 50KB → empty/
// truncated GLM outputs). The critique already analyzed the design; here we send
// only the structural digest (head + :root + section skeleton + first/last chunk)
// so the model knows what to preserve while applying the diff. Output is the
// complete revised HTML.

import type { ArtBrief } from './art-direction';

/** Cap the existing HTML we pass into refine. We send head+tokens (the part the
 *  model must preserve verbatim) plus the tail (the part most edits target).
 *  ~6KB is well under the threshold where GLM-5.2 starts dropping output. */
const HTML_BUDGET = 6000;

function digestHtml(html: string): string {
  if (html.length <= HTML_BUDGET) return html;
  // Keep the <head> + :root tokens (essential to preserve), then the tail.
  const headEnd = html.indexOf('</head>');
  const head = headEnd > 0 ? html.slice(0, headEnd + 7) : html.slice(0, 1500);
  const tail = html.slice(html.length - (HTML_BUDGET - head.length));
  return `${head}\n<!-- …mittlerer Abschnitt ausgelassen, aus dem Digest erhalten … -->\n${tail}`;
}

export function refinePrompt(html: string, refinements: string[], brief: ArtBrief): string {
  const p = brief.palette;
  return [
    `Du bist Art Director UND Senior-Frontend-Engineer. Überarbeite die HTML-Datei und setze JEDE genannte Verfeinerung um — ziel: spürbar MEHR Harmonie, Leben, Ausstrahlung.`,
    ``,
    `ART DIRECTION (bleibt bindend): Mood ${brief.mood} · Akzent ${p.accent} (sparsam) · Fonts "${brief.fonts.display}"/"${brief.fonts.body}" (Google Fonts <link>) · bg ${p.background} · primary ${p.primary}.`,
    `Bildwelt: ${brief.imagery}`,
    `Atmosphäre: ${brief.atmosphere}`,
    ``,
    `VERFEINERUNGEN (alle umsetzen):`,
    ...refinements.map((r, i) => `${i + 1}. ${r}`),
    ``,
    `Regeln: behalte Struktur & Inhalte, hebe nur die AUSFÜHRUNG — charaktervolle Typografie, echte Bildwelt, Atmosphäre (Verlauf/Schatten/Korn/Glow), großzügiger Rhythmus, konsequenter Mood. Responsive + barrierearm bleiben.`,
    `Rekonstriere die ausgelassenen mittleren Abschnitte aus dem Digest unverändert (nur die Verfeinerungen ändern), gib die KOMPLETTE Datei neu aus.`,
    ``,
    `Antworte NUR mit der vollständigen, überarbeiteten HTML-Datei, beginnend mit <!doctype html>. Kein Markdown, kein Kommentar, kein Wort davor/danach.`,
    ``,
    `AKTUELLE HTML (Struktur-Digest — head + Tokens + Schwanz):`,
    digestHtml(html),
  ].join('\n');
}
