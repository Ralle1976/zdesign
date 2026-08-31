// Z.Design — Agent Pipeline: prepare phase
//
// Builds the PipelineContext: art brief, concept specs, memory blocks,
// creative rationale and image blocks (including the exploded-view sequence
// for interactive product briefs). Pure preparation — no HTML generation.

import { db } from '@/lib/db';
import {
  applyConceptToBrief,
  buildArtBrief,
  briefLabel,
} from '@/lib/ai/skills/art-direction';
import { axesLabel, pickCreativeAxes } from '@/lib/ai/skills/creative-diversity';
import {
  creativeSeed,
  detectExperienceMode,
  experienceModeLabel,
  isPremiumBrief,
} from '@/lib/ai/pipeline-intent';
import {
  AGENCY_ANIMATIONS,
  AGENCY_CONCEPT,
  AGENCY_PREMIUM_LUXE,
  getConceptSpecs,
} from '@/lib/ai/skills/agency-craft';
import {
  isInteractiveProductBrief,
  PRODUCT_INTERACTION_SPECS,
  buildExplodedSequencePrompts,
} from '@/lib/ai/interactive-product';
import {
  generateImagesMinimax,
  buildImagePrompts,
  buildThaiFoodPrompts,
  isMinimaxImageConfigured,
} from '@/lib/ai/image-minimax';
import { recallAntiPatterns } from '@/lib/ai/memory/negative-memory';
import { loadUserMemory, userMemoryToPromptBlock } from '@/lib/ai/memory/user-memory';
import { lessonsToPromptBlock } from '@/lib/ai/memory/lessons';
import { loadApprovedRecipeForTopic } from '@/lib/ai/skills/skill-memory';
import { callTextLLM } from '@/lib/ai/call-text-llm';
import type { Concept } from '@/lib/ai/skills/creative-director';
import type { PipelineContext, TraceStep } from './types';

export interface PrepareInput {
  message: string;
  projectId: string;
  concept?: Concept;
  skipVision: boolean;
  maxTheaterRounds: number;
  creativeMode: boolean;
  send: PipelineContext['send'];
  pushTrace: PipelineContext['pushTrace'];
  trace: TraceStep[];
}

/**
 * Exploded-view image block: 3 state images (assembled → half → exploded)
 * the LLM wires into the product stage via data-state conventions.
 */
async function buildInteractiveImageBlock(
  message: string,
  pushTrace: PipelineContext['pushTrace'],
): Promise<string> {
  if (!isMinimaxImageConfigured()) {
    pushTrace('exploded-images', 'Exploded-Bilder übersprungen', 'MiniMax nicht verfügbar');
    return '';
  }
  try {
    const states = buildExplodedSequencePrompts(message);
    const imgs = await generateImagesMinimax(
      states.map((s) => s.prompt),
      {},
      3,
    );
    const urls = imgs.map((i) => i.url).filter(Boolean);
    if (urls.length < 2) {
      pushTrace('exploded-images', 'Exploded-Bilder unvollständig', `${urls.length}/3 generiert`);
      return '';
    }
    const [assembled, half, exploded] = [...urls, urls[0], urls[1]];
    pushTrace('exploded-images', 'Exploded-Sequenz generiert', `${urls.length}/3 Zustände`);
    return (
      '\nEXPLODED-VIEW-SEQUENZ (BINDEND — 3 Zustandsbilder des Produkts):\n' +
      `  Zustand 1 (assembled):  ${assembled}\n` +
      `  Zustand 2 (half):       ${half}\n` +
      `  Zustand 3 (exploded):   ${exploded}\n` +
      'Baue im Produkt-Hero: <div class="product-stage" data-sequence> mit 3 <img class="product-state" data-state="assembled|half|exploded"> (diese 3 URLs).\n' +
      'Kein eigenes JavaScript — der Controller wird automatisch injiziert.\n'
    );
  } catch {
    pushTrace('exploded-images', 'Exploded-Bilder fehlgeschlagen', 'Sequenz übersprungen');
    return '';
  }
}

export async function preparePipeline(input: PrepareInput): Promise<PipelineContext> {
  const { message, projectId, concept, skipVision, maxTheaterRounds, creativeMode, send, pushTrace } = input;

  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error('Project not found');
  }

  // 1) Art direction (deterministic).
  let brief = buildArtBrief(message);
  if (concept) brief = applyConceptToBrief(brief, concept);
  brief.creative = pickCreativeAxes(creativeSeed(message, concept));
  brief.experienceMode = detectExperienceMode(message, concept);
  const premium = isPremiumBrief(message, concept);
  const interactive = isInteractiveProductBrief(message);

  const directionLabel = briefLabel(brief);
  pushTrace('art-direction', 'Art Direction', directionLabel);
  pushTrace('experience-mode', 'Erlebnis-Modus', experienceModeLabel(brief.experienceMode!));
  if (concept) pushTrace('concept', `Konzept: ${concept.name}`, concept.bigIdea);
  if (brief.creative) {
    pushTrace(
      'creative-dna',
      `Kreativ-DNA: ${axesLabel(brief.creative)}`,
      `Struktur ${brief.creative.archetype.name}`,
    );
  }
  if (premium) {
    pushTrace('premium', 'Premium Luxe Mode', 'Agency-Craft + Luxe-Specs aktiv');
  }
  if (interactive) {
    pushTrace('interactive', 'Interaktive Produkt-Visualisierung', 'Exploded View aktiv');
  }

  // With a concept, skip generic layout specs — they fight layoutApproach.
  const conceptSpecs = getConceptSpecs(brief.domain, brief.mood);
  const agencyBlock = concept
    ? AGENCY_ANIMATIONS + AGENCY_CONCEPT + (premium ? AGENCY_PREMIUM_LUXE : '')
    : conceptSpecs.layout + conceptSpecs.typography + conceptSpecs.spacing + conceptSpecs.color + conceptSpecs.motion + AGENCY_ANIMATIONS + AGENCY_CONCEPT + (premium ? AGENCY_PREMIUM_LUXE : '')
    + (interactive ? PRODUCT_INTERACTION_SPECS : '');

  // Negative memory + user preferences.
  const memory = await recallAntiPatterns({ domain: brief.domain, maxTokens: 800 });
  const memoryBlock =
    memory.items.length > 0
      ? `\n\nAUS DEM GEDÄCHTNIS — vergangene Fehler für „${brief.domain}", UNBEDINGT VERMEIDEN:\n${memory.items.map((i) => `- ${i.text}`).join('\n')}\n`
      : '';
  const userMemoryBlock = userMemoryToPromptBlock(await loadUserMemory());
  if (memory.items.length > 0) {
    pushTrace(
      'negative-memory',
      `Gedächtnis: ${memory.items.length} Muster vermeiden`,
      memory.items.map((i) => i.text.replace(/<[^>]+>/g, '')).slice(0, 3).join(' · '),
    );
  }

  // Existing design (refinement-like when the project already holds HTML).
  const bodyExisting =
    typeof (input as unknown as { existingHtml?: string }).existingHtml === 'string' &&
    (input as unknown as { existingHtml: string }).existingHtml.length > 100
      ? (input as unknown as { existingHtml: string }).existingHtml
      : undefined;
  const existing =
    bodyExisting ??
    (project.designMode === 'HTML_ARTIFACT' && project.designHTML
      ? project.designHTML
      : undefined);
  const isRefinementLike = !!existing;

  // 1a) Images: pre-generate for single-pass fallback (multi-pass uses images-first).
  let imageBlock = '';
  const willTryMultiPass = !isRefinementLike;
  if (!willTryMultiPass && isMinimaxImageConfigured()) {
    try {
      const hay = `${message} ${brief.imagery || ''}`.toLowerCase();
      const isThai = /thai|pad thai|imbiss|kurry|curry|basil|nudel|noodle/.test(hay);
      const imgPrompts = isThai
        ? buildThaiFoodPrompts(message, brief.imagery)
        : buildImagePrompts(message, brief.imagery);
      const imgs = await generateImagesMinimax(imgPrompts, {}, 3);
      const urls = imgs.map((i) => i.url).filter(Boolean);
      if (urls.length > 0) {
        imageBlock =
          '\nBILDER (ECHTE FOTOS — VERWENDE NUR DIESE URLs):\n' +
          urls.map((u, i) => `  Bild ${i + 1}: ${u}`).join('\n') +
          '\n';
        pushTrace('images', 'Bilder generiert', `${urls.length} MiniMax-Fotos`);
      }
    } catch {
      pushTrace('images', 'Bilder übersprungen', 'MiniMax nicht verfügbar');
    }
  }

  // 1b) Interactive exploded-view sequence (primary path for product briefs).
  const interactiveBlock = interactive
    ? await buildInteractiveImageBlock(message, pushTrace)
    : '';

  // 1c) LEARN (load) — inject approved recipe as baseline.
  const learnedRecipe = await loadApprovedRecipeForTopic(brief.domain);
  if (learnedRecipe) {
    brief.learnedRecipe = learnedRecipe;
    pushTrace(
      'learn',
      'Bewährtes Rezept geladen',
      `Ø${learnedRecipe.sourceComposite} für ${brief.domain}`,
    );
  }

  // 1d) TWO-PASS rationale (only when a concept is present).
  let designRationale = '';
  if (concept) {
    const ratStart = Date.now();
    const rationalePrompt =
      `Du bist der Art Director für "${concept.name}".\n` +
      `Richtung: ${directionLabel}\n` +
      `Big Idea: ${concept.bigIdea}\n` +
      `Narrativ: ${concept.narrative}\n` +
      `Signature-Visual: ${concept.signatureVisual}\n` +
      `Layout-Ansatz: ${concept.layoutApproach}\n\n` +
      `Schreibe eine prägnante DESIGN-RATIONALE (~200 Wörter, deutsch), die begründet, ` +
      `WARUM diese Richtung funktioniert: welche Gesten, Hierarchie, Kontraste, Typografie ` +
      `und Materialität die Big Idea tragen und das WOW auslösen. Konkret und umsetzbar halten, ` +
      `kein Marketing-Blabla.`;
    try {
      designRationale = (
        await callTextLLM(rationalePrompt, {
          maxTokens: 800,
          temperature: 0.7,
          thinking: true,
          timeoutMs: 180_000,
        })
      ).trim();
      pushTrace(
        'rationale',
        'Design-Rationale (Art Director)',
        `${designRationale.split(/\s+/).length} Wörter in ${((Date.now() - ratStart) / 1000) | 0}s · thinking`,
      );
    } catch (e) {
      console.warn('[agent-pipeline] rationale pass failed:', e instanceof Error ? e.message : e);
      pushTrace(
        'rationale',
        'Design-Rationale übersprungen',
        'Pass 1 fehlgeschlagen — weiter mit Single-Pass',
      );
    }
  }

  return {
    message,
    projectId,
    concept,
    skipVision,
    creativeMode,
    maxTheaterRounds,
    brief,
    directionLabel,
    premium,
    interactive,
    memoryBlock,
    userMemoryBlock,
    lessonsBlock: lessonsToPromptBlock(),
    agencyBlock,
    imageBlock,
    interactiveBlock,
    designRationale,
    rationalePrefix: designRationale
      ? `DESIGN-RATIONALE (vom Art Director):\n${designRationale}\n\n`
      : '',
    bodyExisting,
    existing,
    isRefinementLike,
    send,
    pushTrace,
    trace: input.trace,
  };
}
