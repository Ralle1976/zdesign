// Z.Design — Pipeline intent helpers (deterministic, no LLM).
// Decides creative seeds and premium tier from brief + optional concept.

import type { Concept } from '@/lib/ai/skills/creative-director';

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Seed for pickCreativeAxes — same message alone ⇒ same layout; concept diversifies. */
export function creativeSeed(message: string, concept?: Concept | null): string {
  const base = message.trim() || 'default';
  return concept?.name ? `${base}|${concept.name}` : base;
}

/** Luxury / product-showcase briefs get premium agency-craft injection. */
export function isPremiumBrief(message: string, concept?: Concept | null): boolean {
  const m = fold(message);
  if (
    /\b(uhr|uhren|watch|watches|luxus|luxury|schmuck|jewelry|jewellery|premium|atelier|boutique|high[\s-]?end|exklusiv|exclusive)\b/.test(
      m,
    )
  ) {
    return true;
  }
  if (concept) {
    const c = fold(`${concept.name} ${concept.bigIdea} ${concept.layoutApproach} ${concept.wowAngle}`);
    if (/\b(lux|premium|awwwards|cineast|editorial|magazin|galerie|museum|showcase)\b/.test(c)) {
      return true;
    }
  }
  return false;
}