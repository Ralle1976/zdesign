// Z.Design — Pipeline intent helpers (deterministic, no LLM).
// Decides creative seeds, premium tier, and experience mode from brief + concept.

import type { Concept } from '@/lib/ai/skills/creative-director';

export type ExperienceMode = 'app-shell' | 'scroll-cinematic';

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

/**
 * App-Shell = mehrere Views per Navigation (kein durchscrollbares Landing).
 * Scroll-Cinematic = explizit gewünschtes Scroll-Erlebnis / One-Page-Film.
 *
 * Default: app-shell — Nutzer wollen selten noch eine weitere identische Landingpage.
 */
export function detectExperienceMode(message: string, concept?: Concept | null): ExperienceMode {
  const m = fold(message);
  const c = concept
    ? fold(`${concept.name} ${concept.bigIdea} ${concept.layoutApproach}`)
    : '';

  const wantsScroll =
    /\b(scroll|scrolling|one[\s-]?page|landing[\s-]?page|landingpage|awwwards|kino|film|parallax|sticky[\s-]?panel|von oben nach unten)\b/.test(
      m + ' ' + c,
    );

  const wantsApp =
    /\b(app|portal|dashboard|interface|ui|menü|menu|navigation|nav|tabs|bereiche?|seiten?|views?|wechseln|klick|button|nicht scroll|multi[\s-]?page|mehrere seiten|shop|katalog|buchung|admin)\b/.test(
      m + ' ' + c,
    );

  if (wantsScroll && !wantsApp) return 'scroll-cinematic';
  if (wantsApp) return 'app-shell';
  return 'app-shell';
}

export function experienceModeLabel(mode: ExperienceMode): string {
  return mode === 'app-shell' ? 'App-Shell (View-Navigation)' : 'Scroll-Cinematic';
}