// Z.Design - Fusion Pipeline Zod Schemas
// Validates every LLM output in the panel -> judge -> synthesis pipeline.
// Schemas are intentionally LENIENT (optional fields) so that legitimate model
// variation doesn't trip validation; only real structural breakage (missing id,
// non-object, no extractable design) triggers retry/repair.
//
// Note: Zod v4 deprecates .passthrough(); we use plain z.object() (strip mode).
// Unknown extra keys are dropped, which is fine — we only read declared fields.

import { z } from 'zod';
import { jsonrepair } from 'jsonrepair';

/**
 * Minimal, dependency-free JSON extractor: parses raw JSON, then falls back to
 * the first ```json ... ``` fenced block. The heavy multi-strategy extraction
 * (largest-object, unquoted keys, etc.) lives in ai-prompts.parseAIResponse;
 * this is just enough to validate a single LLM payload.
 */
function extractJsonObject(raw: string): unknown | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    // continue to recovery strategies
  }
  const fence = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // continue to lenient recovery
    }
  }
  // jsonrepair: tolerant parser for malformed/truncated LLM JSON (surplus or
  // mismatched braces, trailing commas, truncated arrays). The regex repair in
  // ai-prompts only appends missing closers and returns null on surplus/mid-
  // tree imbalance — exactly what large nested design trees hit. jsonrepair is
  // the durable safety net so a slightly-malformed synthesis still yields a
  // complete tree instead of a forced template fallback.
  try {
    return JSON.parse(jsonrepair(trimmed));
  } catch {
    return null;
  }
}

// ============ DesignNode (recursive, mirrors src/types/design.ts) ============

// CSS-in-JS style map: { fontSize: '16px', color: '#fff', ... } — accept any values.
const StyleSchema = z.record(z.string(), z.unknown());

// Structural shape we accept (kept loose; the canonical type lives in @/types/design).
export interface DesignNodeLike {
  id: string;
  type: string;
  tag?: string;
  content?: string;
  style?: Record<string, unknown>;
  props?: Record<string, unknown>;
  events?: Record<string, string>;
  meta?: Record<string, unknown>;
  children?: DesignNodeLike[];
}

// A single design node. Recursive via z.lazy so children can nest arbitrarily deep.
export const DesignNodeSchema: z.ZodType<DesignNodeLike> = z.lazy(() =>
  z.object({
    id: z.string().min(1, 'DesignNode requires a non-empty "id"'),
    type: z.string().min(1, 'DesignNode requires a "type"'),
    tag: z.string().optional(),
    content: z.string().optional(),
    style: StyleSchema.optional(),
    props: z.record(z.string(), z.unknown()).optional(),
    events: z.record(z.string(), z.string()).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
    children: z.array(DesignNodeSchema).optional(),
  }),
);

// ============ Panel Proposal (what each panel agent returns) ============

// Agents return varied shapes (content/approach/reasoning, optional designSuggestion).
export const ProposalSchema = z.object({
  content: z.string().optional(),
  approach: z.string().optional(),
  reasoning: z.string().optional(),
  designSuggestion: z.unknown().optional(),
  design: z.unknown().optional(),
  creativity: z.number().min(0).max(1).optional().default(0.5),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

export type Proposal = z.infer<typeof ProposalSchema>;

// ============ Fusion Directive (judge output) ============

// The judge MUST NOT produce the final design — only a directive describing
// which structural/aesthetic elements from each proposal to merge.
export const FusionDirectiveSchema = z.object({
  critique: z.string().optional().default(''),
  fusion_directive: z.string().optional(),
  directive: z.string().optional(), // alternate key some models use
  strengths: z.array(z.string()).optional(),
  issues: z.array(z.string()).optional(),
  ranking: z
    .array(
      z.object({
        role: z.string(),
        rank: z.number().optional(),
        reason: z.string().optional(),
      }),
    )
    .optional(),
});

export type FusionDirective = z.infer<typeof FusionDirectiveSchema>;

// ============ Helpers ============

/**
 * Extract a JSON object from raw LLM text and validate it as a DesignNode tree.
 * Tries: direct JSON -> unwrap a nested `.design` field -> validate.
 * Returns { ok, data?, error? }.
 */
export function parseDesignNode(raw: string): {
  ok: boolean;
  data?: DesignNodeLike;
  error?: string;
} {
  const parsed = extractJsonObject(raw);
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'Response was not valid JSON' };
  }
  // jsonrepair can array-wrap when a surplus '}' splits the tree into multiple
  // top-level JSON values (e.g. the root node plus an orphaned trailing
  // section). Pick the root-like element (type 'root', else the first node
  // carrying children) so the recovered design stays complete.
  let obj = parsed as Record<string, unknown>;
  if (Array.isArray(parsed)) {
    const rootLike = parsed.find(
      (el) =>
        el &&
        typeof el === 'object' &&
        ((el as Record<string, unknown>).type === 'root' ||
          Array.isArray((el as Record<string, unknown>).children)),
    ) as Record<string, unknown> | undefined;
    if (!rootLike) {
      return { ok: false, error: 'No root node in array response' };
    }
    obj = rootLike;
  }
  // unwrap { design: {...} } wrapper if present
  const candidate = (obj.design && typeof obj.design === 'object' ? obj.design : obj) as Record<string, unknown>;
  const result = DesignNodeSchema.safeParse(candidate);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return {
    ok: false,
    error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
  };
}
