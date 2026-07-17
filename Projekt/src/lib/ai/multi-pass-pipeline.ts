/**
 * multi-pass-pipeline.ts — IA → Images-first → Per-view HTML → Shell assembly.
 *
 * Replaces the single 16k-token one-shot with modular passes so each view
 * gets distinct layout and pre-locked imagery.
 */

import { jsonrepair } from 'jsonrepair';
import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import type { Concept } from '@/lib/ai/skills/creative-director';
import { getExperiencePrompt } from '@/lib/ai/app-shell';
import type { ExperienceMode } from '@/lib/ai/pipeline-intent';
import { buildReferenceAnchor } from '@/lib/ai/reference-rag';
import { ensureImageSlots, generateImagesFirst, imageMapToPromptBlock } from '@/lib/ai/images-first';
import { applyImageHarmonyCss } from '@/lib/ai/image-harmony';
import { applyFreshImages } from '@/lib/ai/fresh-images';
import { ULTRA_IMAGE_RULES, ULTRA_QUALITY_BAR } from '@/lib/ai/ultra-quality';
import { cleanHtml } from '@/lib/ai/fusion/fusion-client';

const VIEW_MAX_TOKENS = 8192;
const IA_MAX_TOKENS = 2048;
const GLOBAL_CSS_MAX_TOKENS = 4096;

export interface ImageSlot {
  id: string;
  subject: string;
  aspect?: string;
}

export interface ViewIA {
  id: string;
  label: string;
  purpose: string;
  layoutHint: string;
  sections: Array<{ type: string; headline: string; body: string }>;
  imageSlots: ImageSlot[];
}

export interface DesignIA {
  title: string;
  tagline: string;
  views: ViewIA[];
  nav: Array<{ id: string; label: string }>;
  globalStyle: string;
}

export type ProgressFn = (step: string, label: string, detail?: string) => void;

export interface MultiPassInput {
  brief: ArtBrief;
  message: string;
  concept?: Concept;
  existingHtml?: string;
  creativeMode?: boolean;
  rationalePrefix?: string;
  memoryBlock?: string;
  userMemoryBlock?: string;
  lessonsBlock?: string;
  onProgress?: ProgressFn;
}

export interface MultiPassOutput {
  html: string;
  ia: DesignIA;
  templateId?: string;
  imageCount: number;
}

type LLMCall = (
  prompt: string,
  opts?: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    thinking?: boolean;
  },
) => Promise<string>;

function isValidHtmlDoc(s: string): boolean {
  const lower = s.trim().toLowerCase();
  return (
    (lower.startsWith('<!doctype') || lower.startsWith('<html')) &&
    s.length > 2000 &&
    lower.includes('</html>')
  );
}

function extractJsonBlob(raw: string): string {
  const trimmed = raw.trim().replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function inputFallbackTitle(ia: DesignIA): string {
  return ia.tagline || 'Premium-Erlebnis';
}

function padViewsForAppShell(ia: DesignIA, mode: ExperienceMode): DesignIA {
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

function parseIA(raw: string, mode: ExperienceMode): DesignIA | null {
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

function paletteBlock(brief: ArtBrief, concept?: Concept): string {
  if (concept) {
    const cp = concept.palette;
    return [
      `:root {`,
      `  --bg: ${cp.bg}; --surface: ${cp.surface}; --primary: ${cp.primary};`,
      `  --accent: ${cp.accent}; --text: ${cp.text}; --text-muted: ${cp.textMuted};`,
      `  --border: ${cp.border}; --display-font: ${concept.fonts.display}; --body-font: ${concept.fonts.body};`,
      `}`,
    ].join('\n');
  }
  const p = brief.palette;
  return [
    brief.system.rootCss,
    `/* Palette: bg ${p.background} accent ${p.accent} */`,
  ].join('\n');
}

function buildIAPrompt(input: MultiPassInput, refBlock: string, mode: ExperienceMode): string {
  const b = input.brief;
  const experience = getExperiencePrompt(mode);
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

async function generateIA(
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

function buildViewPrompt(
  view: ViewIA,
  ia: DesignIA,
  input: MultiPassInput,
  imageBlock: string,
  globalCss: string,
): string {
  const b = input.brief;
  const isAppShell = (b.experienceMode ?? 'app-shell') === 'app-shell';
  const activeClass = ia.views[0]?.id === view.id ? ' is-active' : '';
  const hidden = ia.views[0]?.id === view.id ? '' : ' hidden';

  return [
    ULTRA_QUALITY_BAR,
    ``,
    `Du bist Senior Frontend Engineer (Awwwards-Niveau). Generiere NUR EINE View-Section.`,
    ``,
    `PROJEKT: ${ia.title} — ${ia.tagline}`,
    `GLOBAL STYLE: ${ia.globalStyle}`,
    `VIEW: ${view.label} (${view.id}) — ${view.purpose}`,
    `LAYOUT (BINDEND, einzigartig): ${view.layoutHint}`,
    ``,
    `INHALT:`,
    ...view.sections.map(
      (s) => `- [${s.type}] ${s.headline}: ${s.body}`,
    ),
    ``,
    imageBlock,
    ULTRA_IMAGE_RULES,
    ``,
    `SHARED CSS (nutze diese Tokens, dupliziere :root NICHT):`,
    globalCss.slice(0, 3000),
    ``,
    `OUTPUT (exakt ein Element):`,
    `<section id="${view.id}" class="app-view${activeClass}" data-od-id="${view.id}"${hidden}>`,
    `  <style>/* view-scoped CSS */</style>`,
    `  <!-- vollständiger Inhalt mit mindestens 1 Bild aus imageSlots -->`,
    `</section>`,
    ``,
    isAppShell
      ? `KEINE anderen Views. KEIN <html>. NUR die eine <section> mit inline <style>.`
      : `Scroll-Section: <section id="${view.id}" data-od-id="${view.id}">…</section>`,
    `Mindestens 1 <img> mit vorgegebenen URLs. Mobile-first. Deutsch.`,
    `NUTZERAUFTRAG-Kontext: ${input.message.slice(0, 400)}`,
    `Antworte NUR mit dem <section>-Element.`,
  ].join('\n');
}

function extractSection(raw: string, viewId: string): string {
  const cleaned = cleanHtml(raw.trim());
  const match = cleaned.match(/<section[\s\S]*<\/section>/i);
  if (match) return match[0];
  if (cleaned.includes('<section')) {
    return cleaned + '</section>';
  }
  return `<section id="${viewId}" class="app-view" data-od-id="${viewId}">${cleaned}</section>`;
}

async function generateGlobalCss(
  ia: DesignIA,
  input: MultiPassInput,
  callLLM: LLMCall,
): Promise<string> {
  const b = input.brief;
  const prompt = [
    ULTRA_QUALITY_BAR,
    ``,
    `Erstelle SHARED CSS für eine ULTRA-PREMIUM Multi-View HTML-App (NUR CSS, kein HTML).`,
    `Titel: ${ia.title} · Mood: ${b.mood} · Domain: ${b.domain}`,
    `Global Style: ${ia.globalStyle}`,
    `Tokens (kopiere als :root Basis):`,
    paletteBlock(b, input.concept),
    ``,
    `Enthält: :root, body, .app-nav, .app-nav button, .app-view Basis, Typo-Skala (clamp),`,
    `Atmosphäre (Verlauf, Korn, Schatten), prefers-reduced-motion.`,
    `KEIN View-spezifisches Layout — nur globale Tokens + Nav + Utilities.`,
    `Antworte NUR mit CSS (kein <style> Tag).`,
  ].join('\n');

  try {
    const css = await callLLM(prompt, {
      maxTokens: GLOBAL_CSS_MAX_TOKENS,
      temperature: 0.45,
      timeoutMs: 120_000,
    });
    return css.replace(/```css?\s*/gi, '').replace(/```/g, '').trim();
  } catch {
    return paletteBlock(b, input.concept);
  }
}

const SHELL_RUNTIME = `
<style id="__zd_app_shell__-css">
  .app-view { display: none; min-height: calc(100vh - var(--nav-h, 64px)); animation: viewIn .45s cubic-bezier(0.22,1,0.36,1); }
  .app-view.is-active { display: block; }
  @keyframes viewIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .app-nav [data-nav].is-active { color: var(--accent, var(--primary)); }
  @media (prefers-reduced-motion: reduce) { .app-view { animation: none; } }
</style>
<script id="__zd_app_shell__">
(function(){
  var nav = document.getElementById('app-nav');
  var views = document.querySelectorAll('.app-view');
  if (!views.length) return;
  function show(id){
    views.forEach(function(v){ var on = v.id === id; v.classList.toggle('is-active', on); v.hidden = !on; });
    if (nav) nav.querySelectorAll('[data-nav]').forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-nav') === id); });
    try { history.replaceState(null, '', '#' + id); } catch(e){}
    window.scrollTo(0, 0);
  }
  if (nav) nav.addEventListener('click', function(e){
    var btn = e.target.closest('[data-nav]');
    if (!btn) return;
    e.preventDefault();
    show(btn.getAttribute('data-nav'));
  });
  var hash = (location.hash || '').replace('#','');
  if (hash && document.getElementById(hash)) show(hash);
  else if (views[0]) show(views[0].id);
})();
</script>`;

function assembleDocument(
  ia: DesignIA,
  viewHtml: string[],
  globalCss: string,
  input: MultiPassInput,
): string {
  const b = input.brief;
  const mode = b.experienceMode ?? 'app-shell';
  const fontsHref = b.concept?.fonts?.googleFontsHref || b.system.googleFontsHref;
  const fontLink = fontsHref
    ? `<link rel="stylesheet" href="${fontsHref}">`
    : '';

  const navButtons = ia.nav
    .map(
      (n, i) =>
        `<button type="button" data-nav="${n.id}" class="${i === 0 ? 'is-active' : ''}">${n.label}</button>`,
    )
    .join('\n    ');

  const isAppShell = mode === 'app-shell';
  const nav = isAppShell
    ? `<nav id="app-nav" class="app-nav" data-app-nav style="display:flex;gap:1rem;padding:1rem 2rem;position:sticky;top:0;z-index:100;background:var(--surface,var(--bg));border-bottom:1px solid var(--border,color-mix(in oklch,currentColor 12%,transparent))">\n    ${navButtons}\n  </nav>`
    : '';

  const mainContent = viewHtml.join('\n');
  const runtime = isAppShell ? SHELL_RUNTIME : '';

  const doc = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${ia.title}</title>
  ${fontLink}
  <style>
${globalCss}
  </style>
</head>
<body>
  ${nav}
  <main id="app-main">
${mainContent}
  </main>
${runtime}
</body>
</html>`;

  return applyImageHarmonyCss(doc, b.palette);
}

/**
 * Run the full multi-pass pipeline. Returns null when skipped or on failure
 * (caller should fall back to single-pass generateHtmlPrompt).
 */
export async function runMultiPassPipeline(
  input: MultiPassInput,
  callLLM: LLMCall,
): Promise<MultiPassOutput | null> {
  if (input.existingHtml && input.existingHtml.length > 100) {
    return null;
  }

  const progress = input.onProgress ?? (() => {});

  const ref = buildReferenceAnchor(input.brief.domain);
  const refBlock = ref?.promptBlock ?? '';
  if (ref) {
    progress('reference-rag', 'Referenz-Stil geladen', ref.template.name);
  }

  progress('ia-start', 'IA-Struktur (Pass 1)', `${input.brief.domain}`);
  const ia = await generateIA(input, callLLM, refBlock);
  if (!ia) {
    progress('ia-failed', 'IA fehlgeschlagen', 'Fallback Single-Pass');
    return null;
  }
  progress(
    'ia-done',
    'IA-Struktur fertig',
    `${ia.views.length} Views · ${ia.title}`,
  );

  const iaWithSlots = ensureImageSlots(ia, input.brief, input.message);

  progress('images-first', 'Frische Bilder zuerst', 'Palette-Lock · kein Stock');
  const imgResult = await generateImagesFirst(iaWithSlots, input.brief, input.message);
  progress(
    'images-first-done',
    'Bilder frisch generiert',
    `${imgResult.generated} neu · ${imgResult.failed} fehlgeschlagen`,
  );
  const imageBlock = imageMapToPromptBlock(imgResult.map);

  progress('global-css', 'Shared CSS (Pass 2a)', 'Tokens + Nav');
  const globalCss = await generateGlobalCss(iaWithSlots, input, callLLM);

  const viewHtml: string[] = [];
  for (let i = 0; i < iaWithSlots.views.length; i++) {
    const view = iaWithSlots.views[i];
    progress('view-start', `View: ${view.label}`, `Pass 2b · ${i + 1}/${iaWithSlots.views.length}`);
    try {
      const raw = await callLLM(
        (input.lessonsBlock || '') +
          (input.memoryBlock || '') +
          (input.userMemoryBlock || '') +
          buildViewPrompt(view, iaWithSlots, input, imageBlock, globalCss),
        {
          maxTokens: VIEW_MAX_TOKENS,
          temperature: input.creativeMode ? 0.58 : 0.5,
          timeoutMs: 180_000,
        },
      );
      viewHtml.push(extractSection(raw, view.id));
    } catch (e) {
      console.warn(
        '[multi-pass] view failed',
        view.id,
        e instanceof Error ? e.message : e,
      );
      progress('view-failed', `View ${view.label} fehlgeschlagen`, 'Abbruch → Fallback');
      return null;
    }
  }

  progress('assemble', 'Shell zusammenbauen (Pass 3)', `${viewHtml.length} Sections`);
  let html = assembleDocument(iaWithSlots, viewHtml, globalCss, input);

  if (!isValidHtmlDoc(html)) {
    progress('assemble-failed', 'Assembly ungültig', 'Fallback Single-Pass');
    return null;
  }

  try {
    const fresh = await applyFreshImages(html, {
      domain: input.brief.domain,
      message: input.message,
      mood: input.brief.mood,
      palette: input.brief.palette,
      maxImages: 6,
    });
    if (fresh.generated > 0) {
      html = fresh.html;
      progress('images-refresh', 'Bilder aufgefrischt', `${fresh.generated} neu generiert`);
    }
  } catch {
    /* non-fatal */
  }

  progress(
    'multi-pass-done',
    'Multi-Pass fertig',
    `${(html.length / 1024).toFixed(1)} KB · Template ${ref?.template.id ?? '—'}`,
  );

  return {
    html,
    ia: iaWithSlots,
    templateId: ref?.template.id,
    imageCount: Object.keys(imgResult.map).length,
  };
}