// Z.Design — Multi-Pass Pipeline: IA pass (Pass 1)
//
// Information-Architecture JSON generation: the LLM plans the views/sections/
// image slots; HTML generation happens per view afterwards.

import { jsonrepair } from 'jsonrepair';
import { getExperiencePrompt } from '@/lib/ai/app-shell';
import type { DesignIA, LLMCall, MultiPassInput, ViewIA } from './types';

const IA_MAX_TOKENS = 2048;

export function extractJsonBlob(raw: string): string {
  const trimmed = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function inputFallbackTitle(ia: DesignIA): string {
  return ia.tagline || 'Premium-Erlebnis';
}

function padViewsForAppShell(ia: DesignIA, mode: string): DesignIA {
  if (mode !== 'app-shell' || ia.views.length >= 4) return ia;
  const defaults = [
    { id: 'view-home', label: 'Start', purpose: 'Intro & Hero', layoutHint: 'asymmetrisch split hero' },
    { id: 'view-catalog', label: 'Katalog', purpose: 'Angebot/Produkte', layoutHint: 'bento grid variiert' },
    { id: 'view-story', label: 'Story', purpose: 'Geschichte/Prozess', layoutHint: 'editorial magazine' },
    { id: 'view-contact', label: 'Kontakt', purpose: 'CTA & Kontakt', layoutHint: 'minimaler Fokus-CTA' },
  ];
  const views = [...ia.views];
  for (let i = views.length; i < 4; i++) {
    const d = defaults[i];
    views.push({
      ...d,
      sections: [{ type: 'content', headline: ia.title, body: ia.tagline || inputFallbackTitle(ia) }],
      imageSlots: [{ id: `img-pad-${i}`, subject: `${ia.title} — Motiv ${i + 1}`, aspect: '16:9' }],
    });
  }
  const nav = views.map((v) => ({ id: v.id, label: v.label }));
  return { ...ia, views, nav };
}

function parseIA(raw: string, mode: string): DesignIA | null {
  try {
    const repaired = jsonrepair(extractJsonBlob(raw));
    const obj = JSON.parse(repaired) as Partial<DesignIA>;
    if (!obj.views?.length || obj.views.length < 2) return null;

    const views: ViewIA[] = obj.views.slice(0, 6).map((v, i) => ({
      id: v.id || `view-${i + 1}`,
      label: v.label || `View ${i + 1}`,
      purpose: v.purpose || '',
      layoutHint: v.layoutHint || 'editorial asymmetrisch',
      sections: Array.isArray(v.sections) ? v.sections.slice(0, 6) : [],
      imageSlots: Array.isArray(v.imageSlots) ? v.imageSlots.slice(0, 3) : [],
    }));

    const nav =
      Array.isArray(obj.nav) && obj.nav.length > 0
        ? obj.nav.map((n, i) => ({
            id: n.id || views[i]?.id || `view-${i + 1}`,
            label: n.label || views[i]?.label || `Tab ${i + 1}`,
          }))
        : views.map((v) => ({ id: v.id, label: v.label }));

    const ia: DesignIA = {
      title: obj.title || 'Design',
      tagline: obj.tagline || '',
      views,
      nav: nav.slice(0, views.length),
      globalStyle: obj.globalStyle || '',
    };
    return padViewsForAppShell(ia, mode);
  } catch {
    return null;
  }
}

function buildIAPrompt(input: MultiPassInput, refBlock: string, mode: string): string {
  const b = input.brief;
  const experience = getExperiencePrompt(mode as never);
  const viewCount = mode === 'app-shell' ? '4-6 discrete views (app-shell)' : '5-7 scroll sections';

  return [
    input.rationalePrefix || '',
    `Du bist Information Architect für ein ULTRA-PREMIUM Webdesign (Agentur-Niveau).`,
    `Erstelle eine IA-Struktur als JSON (kein HTML, kein Markdown, kein Thinking-Text).`,
    ``,
    `AUFTRAG: ${input.message}`,
    `Domain: ${b.domain} · Mood: ${b.mood} · Archetyp: ${b.archetype}`,
    `Modus: ${mode} — ${viewCount}`,
    refBlock,
    experience.slice(0, 1200),
    ``,
    `JSON-Schema (exakt):`,
    `{`,
    `  "title": "Seitentitel",`,
    `  "tagline": "kurzer Claim",`,
    `  "globalStyle": "1-2 Sätze: Licht, Materialität, eine Signatur-Geste",`,
    `  "nav": [{ "id": "view-home", "label": "Start" }, ...],`,
    `  "views": [{`,
    `    "id": "view-home",`,
    `    "label": "Start",`,
    `    "purpose": "was diese View leistet",`,
    `    "layoutHint": "asymmetrisch split / bento / editorial — UNIQUE pro View",`,
    `    "sections": [{ "type": "hero|grid|story|cta", "headline": "...", "body": "..." }],`,
    `    "imageSlots": [{ "id": "hero-img", "subject": "konkretes Motiv für Bild-Gen", "aspect": "16:9" }]`,
    `  }]`,
    `}`,
    ``,
    `REGELN:`,
    `- EXAKT 4 Views bei app-shell (view-home, view-catalog, view-story, view-contact)`,
    `- Jede View: ANDERES layoutHint + mindestens 1 imageSlot mit konkretem Foto-Motiv`,
    `- Mindestens 4 imageSlots gesamt — spezifische Subjekte für Bild-Generierung`,
    `- globalStyle: mutige Signatur-Geste + Lichtführung (1-2 Sätze)`,
    `Antworte NUR mit gültigem JSON — erstes Zeichen {, letztes Zeichen }.`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function generateIA(
  input: MultiPassInput,
  callLLM: LLMCall,
  refBlock: string,
): Promise<DesignIA | null> {
  const mode = input.brief.experienceMode ?? 'app-shell';
  const raw = await callLLM(buildIAPrompt(input, refBlock, mode), {
    maxTokens: IA_MAX_TOKENS,
    temperature: input.creativeMode ? 0.85 : 0.7,
    timeoutMs: 120_000,
    thinking: false,
  });
  return parseIA(raw, mode);
}
