// Z.Design — Agent Pipeline: shared types
//
// The agentic design pipeline (art-direction → generate → critique theater →
// ship) split into phase modules so each file has one responsibility:
//   prepare.ts  — brief, memory, concept blocks, rationale, image blocks
//   generate.ts — multi-pass / single-pass HTML generation + post-processing
//   critique.ts — anti-slop lint, critique theater, vision critique
//   ship.ts     — final images, audits, learning, persistence, complete frame
//   index.ts    — orchestration (SSE wiring)

import type { Concept } from '@/lib/ai/skills/creative-director';
import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import type { TheaterResult } from '@/lib/ai/skills/critic-theater';

export type SendFn = (payload: Record<string, unknown>) => void;

export interface TraceStep {
  step: string;
  label: string;
  detail?: string;
}

/** Everything the phases need — built once in prepare, consumed downstream. */
export interface PipelineContext {
  message: string;
  projectId: string;
  concept?: Concept;
  skipVision: boolean;
  creativeMode: boolean;
  maxTheaterRounds: number;

  brief: ArtBrief;
  directionLabel: string;
  premium: boolean;
  interactive: boolean;

  memoryBlock: string;
  userMemoryBlock: string;
  lessonsBlock: string;
  agencyBlock: string;
  imageBlock: string;
  interactiveBlock: string;
  designRationale: string;
  rationalePrefix: string;

  bodyExisting?: string;
  existing?: string;
  isRefinementLike: boolean;

  send: SendFn;
  pushTrace: (step: string, label: string, detail?: string) => void;
  trace: TraceStep[];
}

export interface GenerateResult {
  html: string;
  multiPassViews?: number;
  multiPassImages?: number;
  templateId?: string;
  genMs: number;
}

export interface CritiqueResult {
  html: string;
  bestComposite: number;
  bestTheater: TheaterResult | null;
  bestRound: number;
}
