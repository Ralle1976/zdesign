/**
 * images-first.ts — Generate palette-locked images BEFORE HTML assembly.
 * No Unsplash fallback — every slot gets a freshly generated photo or retry.
 */

import {
  buildHarmonizedImagePrompt,
  imageStyleSeed,
} from '@/lib/ai/image-harmony';
import {
  generateImagesMinimax,
  isMinimaxImageConfigured,
  buildImagePrompts,
  buildThaiFoodPrompts,
} from '@/lib/ai/image-minimax';
import { generateImageWithProvider } from '@/lib/ai/image-providers';
import { getActiveImageProvider } from '@/lib/ai/call-text-llm';
import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import type { DesignIA, ImageSlot, ViewIA } from '@/lib/ai/multi-pass-pipeline';

const MIN_SLOTS = 4;
const MAX_SLOTS = 8;

export interface ImageFirstResult {
  map: Record<string, string>;
  generated: number;
  failed: number;
}

function collectSlots(ia: DesignIA): ImageSlot[] {
  const slots: ImageSlot[] = [];
  for (const view of ia.views) {
    for (const slot of view.imageSlots) {
      slots.push(slot);
    }
  }
  return slots.slice(0, MAX_SLOTS);
}

/** Ensure at least MIN_SLOTS image subjects across views (synthesized from brief). */
export function ensureImageSlots(ia: DesignIA, brief: ArtBrief, message: string): DesignIA {
  const slots = collectSlots(ia);
  if (slots.length >= MIN_SLOTS) return ia;

  const hay = `${message} ${brief.domain}`.toLowerCase();
  const isThai = /thai|pad thai|imbiss|curry|siam/.test(hay);
  const prompts = isThai
    ? buildThaiFoodPrompts(message, brief.imagery)
    : buildImagePrompts(message, brief.imagery);

  const views = [...ia.views];
  let slotIdx = slots.length;

  const defaultViews: Partial<ViewIA>[] = [
    { id: 'view-home', label: 'Start', purpose: 'Hero & Intro' },
    { id: 'view-catalog', label: 'Katalog', purpose: 'Produkte/Leistungen' },
    { id: 'view-story', label: 'Story', purpose: 'Geschichte/Prozess' },
    { id: 'view-contact', label: 'Kontakt', purpose: 'CTA/Kontakt' },
  ];

  while (slotIdx < MIN_SLOTS) {
    const vIdx = slotIdx % Math.max(views.length, 1);
    if (!views[vIdx]) {
      const dv = defaultViews[vIdx] || defaultViews[0];
      views.push({
        id: dv.id || `view-${vIdx + 1}`,
        label: dv.label || `View ${vIdx + 1}`,
        purpose: dv.purpose || '',
        layoutHint: 'editorial asymmetrisch',
        sections: [{ type: 'hero', headline: ia.title, body: ia.tagline }],
        imageSlots: [],
      });
    }
    const subject = prompts[slotIdx % prompts.length] || message.slice(0, 100);
    views[vIdx].imageSlots = views[vIdx].imageSlots || [];
    views[vIdx].imageSlots.push({
      id: `img-${slotIdx + 1}`,
      subject,
      aspect: slotIdx === 0 ? '16:9' : '4:3',
    });
    slotIdx++;
  }

  return { ...ia, views };
}

async function generateOne(
  slot: ImageSlot,
  brief: ArtBrief,
  styleSeed: string,
  attempt: number,
): Promise<string | null> {
  const prompt = buildHarmonizedImagePrompt(slot.subject, {
    domain: brief.domain,
    mood: brief.mood,
    palette: brief.palette,
    styleSeed: `${styleSeed}-a${attempt}`,
  });

  if (isMinimaxImageConfigured()) {
    try {
      const imgs = await generateImagesMinimax([prompt], { aspectRatio: slot.aspect || '16:9' }, 1);
      const url = imgs[0]?.url;
      if (url) return url;
    } catch {
      /* fall through */
    }
  }

  try {
    const provider = await getActiveImageProvider();
    const size =
      slot.aspect === '9:16' ? '768x1024' : slot.aspect === '1:1' ? '1024x1024' : '1024x768';
    const img = await generateImageWithProvider(prompt, {
      provider: provider.id,
      model: provider.model,
      size,
    });
    return img?.url ?? null;
  } catch {
    return null;
  }
}

export async function generateImagesFirst(
  ia: DesignIA,
  brief: ArtBrief,
  message: string,
): Promise<ImageFirstResult> {
  const enriched = ensureImageSlots(ia, brief, message);
  const slots = collectSlots(enriched);
  const map: Record<string, string> = {};
  let generated = 0;
  let failed = 0;

  if (slots.length === 0) {
    return { map, generated, failed };
  }

  const styleSeed = `${imageStyleSeed(brief.domain, brief.palette)}-${Date.now()}`;

  await Promise.all(
    slots.map(async (slot, i) => {
      for (let attempt = 0; attempt < 2; attempt++) {
        const url = await generateOne(slot, brief, `${styleSeed}-${i}`, attempt);
        if (url) {
          map[slot.id] = url;
          generated++;
          return;
        }
      }
      failed++;
      console.warn(`[images-first] slot ${slot.id} failed after retries`);
    }),
  );

  return { map, generated, failed };
}

export function imageMapToPromptBlock(map: Record<string, string>): string {
  const entries = Object.entries(map);
  if (entries.length === 0) {
    return 'BILDER: Generierung läuft — verwende thematische <img> Platzhalter mit data-od-img Slot-IDs.';
  }
  return [
    'BILDER (FRISCH GENERIERT — VERWENDE AUSSCHLIESSLICH DIESE URLs als <img src>):',
    ...entries.map(([id, url]) => `  ${id}: ${url}`),
    'PFLICHT: Jedes Bild als großes editorial <img> mit alt-Text. KEINE Unsplash/Stock-URLs. Gleiche Farbgebung in allen Fotos.',
  ].join('\n');
}