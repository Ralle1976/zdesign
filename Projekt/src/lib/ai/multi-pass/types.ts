// Z.Design — Multi-Pass Pipeline: shared types

import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import type { Concept } from '@/lib/ai/skills/creative-director';
import type { ExperienceMode } from '@/lib/ai/pipeline-intent';

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
  interactiveBlock?: string;
  onProgress?: ProgressFn;
}

export interface MultiPassOutput {
  html: string;
  ia: DesignIA;
  templateId?: string;
  imageCount: number;
}

export type LLMCall = (
  prompt: string,
  opts?: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;
    thinking?: boolean;
  },
) => Promise<string>;

export type { ExperienceMode };
