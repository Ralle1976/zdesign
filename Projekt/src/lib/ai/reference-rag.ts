/**
 * reference-rag.ts — Style anchor from curated templates/refs/.
 *
 * Picks the best domain-matching template and extracts a compact snippet
 * (tokens + layout DNA) for multi-pass prompts — not full adapt-from-reference.
 */

import { pickTemplate } from '@/lib/ai/templates/registry';
import { loadReferenceHtml } from '@/lib/ai/templates/generate-from-reference';
import type { Template } from '@/lib/ai/templates/types';

export interface ReferenceAnchor {
  template: Template;
  snippet: string;
  promptBlock: string;
}

/** Extract :root tokens + a layout excerpt from reference HTML. */
function extractStyleAnchor(html: string, maxChars: number): string {
  const parts: string[] = [];

  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (styleMatch) {
    const css = styleMatch[1];
    const rootMatch = css.match(/:root\s*\{[\s\S]*?\}/i);
    if (rootMatch) parts.push(rootMatch[0]);
    const keyframes = [...css.matchAll(/@keyframes\s+[\w-]+[\s\S]*?\}/gi)].slice(0, 2);
    for (const k of keyframes) parts.push(k[0]);
    if (parts.join('\n').length < maxChars * 0.6) {
      parts.push(css.slice(0, Math.min(2000, maxChars)));
    }
  }

  const sectionMatch = html.match(/<section[^>]*>[\s\S]{0,1200}/i);
  if (sectionMatch) parts.push(`\n<!-- layout excerpt -->\n${sectionMatch[0]}…`);

  return parts.join('\n\n').slice(0, maxChars);
}

/**
 * Build a prompt block anchoring generation to a proven template's design DNA.
 * Returns null when no template or reference file is available.
 */
export function buildReferenceAnchor(
  domain: string,
  maxChars = 4500,
): ReferenceAnchor | null {
  const template = pickTemplate(domain);
  if (!template) return null;

  try {
    const html = loadReferenceHtml(template);
    const snippet = extractStyleAnchor(html, maxChars);
    const sig = template.signature;
    const promptBlock = [
      `═══ REFERENZ-STIL-ANKER (${template.name}) ═══`,
      `Layout-Geste: ${sig.layout} · Bewegung: ${sig.motion.join(' + ')} · Effekt: ${sig.effect}`,
      `Übernimm diese Gestaltungs-DNA (Palette-Rhythmus, Typo-Skala, Sektions-Logik) — adaptiere Inhalt, nicht die Sprache.`,
      ``,
      snippet,
      `═══ ENDE REFERENZ ═══`,
    ].join('\n');

    return { template, snippet, promptBlock };
  } catch {
    return null;
  }
}