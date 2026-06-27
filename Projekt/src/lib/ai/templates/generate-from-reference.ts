/**
 * templates/generate-from-reference.ts — the FLOOR mechanism.
 *
 * Instead of "emit a complete HTML design from zero" (caps ~6-7, proven), this
 * loads a known-good reference template and asks the model to ADAPT it to the
 * new brief — keeping the template's palette, typography, signature gesture,
 * layout and structure, only swapping content/topic. This is how Open Design /
 * onepage hit 8+: the heavy design work is pre-baked in the reference; the model
 * adapts rather than invents. Pair with the vision-critique loop for the ceiling.
 *
 * Pure: reads the reference HTML + returns a prompt string for callZai.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import type { Template } from './types';
import type { CreativeAxes } from '@/lib/ai/skills/creative-diversity';

const REFS_DIR = join(process.cwd(), 'src', 'lib', 'ai', 'templates', 'refs');

/** Load a template's reference HTML (throws if missing — caller should handle). */
export function loadReferenceHtml(template: Template): string {
  return readFileSync(join(REFS_DIR, template.referencePath), 'utf8');
}

/**
 * Build the ADAPT prompt: keep the reference's design DNA, swap content to the
 * new brief. The model receives a full working design and tailors it — far more
 * reliable than from-zero invention.
 */
export function buildAdaptPrompt(
  template: Template,
  referenceHtml: string,
  message: string,
  axes?: CreativeAxes | null,
): string {
  const sig = template.signature;
  const p = template.palette;
  const f = template.fonts;
  const axesLine = axes
    ? `BEWAHRE zusätzlich diese Signatur-Gesten des Templates (sie sind schon im Referenz-HTML enthalten — übersetze/skaliere sie 1:1, erfinde keine neuen): Struktur ${sig.layout} · Bewegung ${sig.motion.join(' + ')} · Effekt ${sig.effect}.`
    : `BEWAHRE die Signatur-Geste des Templates: Struktur ${sig.layout} · Bewegung ${sig.motion.join(' + ')} · Effekt ${sig.effect}.`;

  return [
    `Du bist Art Director UND Senior-Frontend-Engineer. Unten steht ein AUSGEREIFTES REFERENZ-DESIGN (ein getestetes Template) für eine bestimmte Branche. Deine Aufgabe: ADAPTIERE es 1:1 an einen NEUEN Auftrag — behalte die gesamte Design-DNA (Palette, Typografie, Signatur-Geste, Layout-Struktur, Atmosphäre, Bewegung), tausche nur INHALT/THEMA/Text/Bilder-Platzierung passend zum neuen Auftrag aus. Kopiere NICHT blind — passe den Inhalt überzeugend an, aber erfinde KEINE neue Gestaltungssprache.`,
    ``,
    `TEMPLATE-DNA (BINDEND — nicht abweichen):`,
    `Palette: bg ${p.background} · surface ${p.surface} · primary ${p.primary} · Akzent ${p.accent}${p.textMuted ? ` · text ${p.text} · muted ${p.textMuted}` : ''}.`,
    `Schriften: Display "${f.display}" · Body "${f.body}".`,
    axesLine,
    ``,
    `REGELN:`,
    `- Behalte ALLE CSS-Variablen, Verläufe, Schatten, Animationen (@keyframes), Bewegungen und die Layout-Struktur des Referenz-HTML bei.`,
    `- Tausche nur: Titel, Texte, Sektions-Inhalte, thematisch passende <img alt> und Bildplatzierung. Bild-URLs: verwende thematisch passende Platzhalter (z. B. https://images.unsplash.com/<id>) oder belasse die Referenz-Struktur.`,
    `- Schreibe KOMPAKTES CSS — die vollständige Datei mit </html> MUSS in eine Antwort passen. Letzter Token = </html>.`,
    `- Mobile-first responsive, prefers-reduced-motion, semantisch, alt-Texte.`,
    ``,
    `NEUER AUFTRAG (dafür den Inhalt adaptieren):`,
    message,
    ``,
    `REFERENZ-DESIGN (diese DNA bewahren, Inhalt adaptieren):`,
    referenceHtml,
    ``,
    `Antworte NUR mit der vollständigen adaptierten HTML-Datei (<!doctype html> ... </html>). Kein Markdown, kein Kommentar.`,
  ].join('\n');
}
