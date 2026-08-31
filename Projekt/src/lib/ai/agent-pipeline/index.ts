// Z.Design — Agent Pipeline: orchestrator
//
// Wires the phase modules together:
//   prepare → generate → critique → ship
// Emits SSE progress frames through `send` as each phase advances.

import type { Concept } from '@/lib/ai/skills/creative-director';
import { preparePipeline } from './prepare';
import { generateDesign } from './generate';
import { critiqueDesign } from './critique';
import { shipDesign } from './ship';
import type { PipelineContext, TraceStep } from './types';

export interface AgentPipelineParams {
  message: string;
  projectId: string;
  concept?: Concept;
  skipVision?: boolean;
  maxTheaterRounds?: number;
  creativeMode?: boolean;
  send: (payload: Record<string, unknown>) => void;
}

export async function runAgentPipeline(params: AgentPipelineParams): Promise<void> {
  const {
    message,
    projectId,
    concept,
    skipVision = false,
    maxTheaterRounds = 2,
    creativeMode = false,
    send,
  } = params;

  if (!message || !projectId) {
    send({ step: 'error', message: 'message and projectId are required' });
    return;
  }

  const trace: TraceStep[] = [];
  const pushTrace = (step: string, label: string, detail?: string) => {
    trace.push({ step, label, detail });
    const frame: Record<string, unknown> = { step, label };
    if (detail !== undefined) frame.detail = detail;
    send(frame);
  };

  const ctx: PipelineContext = await preparePipeline({
    message,
    projectId,
    concept,
    skipVision,
    maxTheaterRounds,
    creativeMode,
    send,
    pushTrace,
    trace,
  });

  const generated = await generateDesign(ctx);
  const critique = await critiqueDesign(ctx, generated.html);
  await shipDesign(ctx, critique);
}
