/**
 * patch-proposer.ts — I3: turn Correlations into targeted SkillPatches.
 *
 * The improvement layer's "proposer". For every Correlation (from
 * correlation-engine, I2) whose confidence clears PROPOSAL_CONFIDENCE_THRESHOLD,
 * it mints a concrete SkillPatch — a precise proposed edit targeting a real
 * skill (art-direction / design-system, a specific audit check, or the
 * creative-director).
 *
 * Patches are *proposals*, never applied here. They land in data/patches.jsonl
 * with status "proposed" and flow into the approval-gated patch-applier (I4),
 * which auto-applies only when confidence >= 0.8 AND sampleSize >= 5.
 *
 * ── Type contract ──────────────────────────────────────────────────────────
 * This file OWNS the `SkillPatch` type that patch-applier (I4) and its test
 * consume. That contract is fixed:
 *   { id, skill, type: PatchType, summary, payload, confidence, sampleSize,
 *     status, version, createdAt: ISO-string, updatedAt, reason? }
 * The I3 task spec describes patches using a different surface
 * ({ skillId, old, new, rationale, source, type: 'add-rule'|... }). We honour
 * the spec's INTENT by carrying those fields inside `payload` (and folding the
 * rationale into `summary`), while keeping the load-bearing SkillPatch fields
 * stable so I4 keeps working untouched. `PatchProposal` (below) exposes the
 * spec-exact shape for callers/tests that want it.
 *
 * Storage: process.env.PATCHES_PATH || './data/patches.jsonl'  (append-only
 * JSONL). Never throws — a proposer failure must never break a design response.
 */
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { randomUUID } from 'crypto'
import { dirname } from 'path'

import type { Correlation } from './correlation-engine'

// ─── Public types (load-bearing — do not break) ────────────────────────────

export type PatchStatus = 'proposed' | 'applied' | 'approved' | 'rejected' | 'reverted'

export type PatchType =
  | 'guidance' // add / replace a snippet of soul-guidance or skill prompt
  | 'token' // swap an enforced design-direction token
  | 'recipe' // fold in a learned DesignLesson recipe
  | 'weight' // tune a panelist / fusion weight
  | 'guardrail' // add / relax an audit guardrail

export interface SkillPatch {
  /** Unique id (uuid). */
  id: string
  /** Which skill this targets (e.g. 'art-direction', 'creative-director'). */
  skill: string
  /** Kind of change. */
  type: PatchType
  /** Human-readable summary of the change (one-line rationale). */
  summary: string
  /** The proposed payload — snippet, token map, recipe id, spec fields, etc. */
  payload: Record<string, unknown>
  /** Normalised confidence in [0, 1]. */
  confidence: number
  /** How many traces / lessons informed this patch. */
  sampleSize: number
  /** Lifecycle status. */
  status: PatchStatus
  /** Monotonic version, bumped on each status transition. */
  version: number
  /** ISO timestamp of creation. */
  createdAt: string
  /** ISO timestamp of the last status transition. */
  updatedAt: string
  /** Optional reason for the most recent transition. */
  reason?: string
}

// ─── Spec-exact proposal surface (I3 task spec) ────────────────────────────
//
// The task spec's own SkillPatch shape. proposePatches() returns SkillPatch[]
// (the load-bearing type, so I4 can consume the output directly), but each
// patch's `payload` carries these fields verbatim, and PatchProposal is
// exported for callers/tests that want the spec's vocabulary.

export type ProposalType =
  | 'add-rule'
  | 'adjust-weight'
  | 'tweak-wording'
  | 'add-keyword'
  | 'modify-threshold'

export type ProposalSource = 'auto-correlation' | 'user-feedback' | 'gepa-offline'

export type ProposalStatus = 'proposed' | 'applied' | 'reverted' | 'rejected'

export interface PatchProposal {
  skillId: string
  type: ProposalType
  old: string
  new: string
  rationale: string
  confidence: number
  source: ProposalSource
  status: ProposalStatus
  /** epoch-ms (spec) — also mirrored as ISO string in SkillPatch.createdAt. */
  createdAt: number
}

/** Minimum correlation confidence required to propose a patch at all. */
export const PROPOSAL_CONFIDENCE_THRESHOLD = 0.6

// ─── Existing constructor (preserved verbatim for I4 + its test) ────────────

/** Construct a fresh patch with sensible defaults. Never throws. */
export function makePatch(input: {
  skill: string
  type: PatchType
  summary: string
  payload?: Record<string, unknown>
  confidence: number
  sampleSize: number
}): SkillPatch {
  const now = new Date().toISOString()
  const confidence =
    typeof input.confidence === 'number' && Number.isFinite(input.confidence)
      ? Math.max(0, Math.min(1, input.confidence))
      : 0
  const sampleSize =
    typeof input.sampleSize === 'number' && Number.isFinite(input.sampleSize)
      ? Math.max(0, Math.floor(input.sampleSize))
      : 0
  return {
    id: randomUUID(),
    skill: String(input.skill ?? ''),
    type: input.type,
    summary: String(input.summary ?? ''),
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    confidence,
    sampleSize,
    status: 'proposed',
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
}

// ─── Correlation parsing ───────────────────────────────────────────────────
//
// correlation-engine emits Correlation.factor as "<kind>:<value>", e.g.
//   "palette:Cormorant", "concept:editorial", "model:glm-5.2",
//   "auditFindings:<3". The kind prefix tells us which skill to target and
//   which ProposalType to emit. `effect` carries the signed delta, e.g.
//   "+1.2 composite (7.8 vs 6.6 baseline) — higher".

interface ParsedCorrelation {
  kind: string // 'palette' | 'concept' | 'model' | 'auditFindings' | unknown
  value: string // the trait (e.g. "Cormorant", "<3", "editorial")
  delta: number // signed effect on composite, parsed from `effect`
  confidence: number
  sampleSize: number
  recommendation: string
}

/** Pull the leading signed float out of an effect string like "+1.2 composite…". */
function parseDelta(effect: string): number {
  const m = effect.match(/([+-]?\d+(?:\.\d+)?)/)
  if (!m) return 0
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : 0
}

function parseCorrelation(c: Correlation): ParsedCorrelation {
  const factor = String(c?.factor ?? '')
  const split = factor.indexOf(':')
  const kind = split >= 0 ? factor.slice(0, split) : factor
  const value = split >= 0 ? factor.slice(split + 1) : ''
  return {
    kind,
    value,
    delta: parseDelta(String(c?.effect ?? '')),
    confidence:
      typeof c?.confidence === 'number' && Number.isFinite(c.confidence)
        ? Math.max(0, Math.min(1, c.confidence))
        : 0,
    sampleSize:
      typeof c?.sampleSize === 'number' && Number.isFinite(c.sampleSize)
        ? Math.max(0, Math.floor(c.sampleSize))
        : 0,
    recommendation: String(c?.recommendation ?? ''),
  }
}

// ─── Per-kind proposal builders ─────────────────────────────────────────────
//
// Each builder returns a spec-shape PatchProposal targeting a real skill, or
// null if the correlation is too vague to act on (e.g. an empty trait). The
// rationale is always grounded in the correlation's own numbers.

interface ProposalInput {
  delta: number
  confidence: number
  sampleSize: number
  recommendation: string
}

function paletteProposal(value: string, p: ProposalInput): PatchProposal | null {
  if (!value) return null
  const accent = value
  const uplift = p.delta >= 0
  return {
    skillId: 'design-system',
    type: 'adjust-weight',
    old: `Palette preference is uniform; accent "${accent}" carries no selection boost.`,
    new: uplift
      ? `Bias palette selection toward accent "${accent}" (raise its weight).`
      : `Deprioritise accent "${accent}" (lower its weight).`,
    rationale:
      p.recommendation ||
      `Designs using accent "${accent}" scored ${p.delta.toFixed(2)} composite vs. baseline (n=${p.sampleSize}).`,
    confidence: p.confidence,
    source: 'auto-correlation',
    status: 'proposed',
    createdAt: Date.now(),
  }
}

function auditProposal(value: string, p: ProposalInput): PatchProposal | null {
  // "fewer findings = higher score" → tighten the audit so the recurring issue
  // is caught (and auto-fixed) before scoring. value is a band like "<3".
  const band = value || '<3'
  return {
    // Target the audit suite as a whole — the correlation is about finding
    // COUNT, not a specific findingId, so 'audit-suite' is the honest target.
    skillId: 'audit-suite',
    type: 'modify-threshold',
    old: `Audit loop ships designs without enforcing a "${band}" finding budget.`,
    new: `Add a guardrail: block ship when audit findings exceed the "${band}" band; push the refine loop harder first.`,
    rationale:
      p.recommendation ||
      `Designs in the "${band}"-finding band scored ${Math.abs(p.delta).toFixed(2)} composite higher (n=${p.sampleSize}) — tightening the audit budget should lift downstream scores.`,
    confidence: p.confidence,
    source: 'auto-correlation',
    status: 'proposed',
    createdAt: Date.now(),
  }
}

function conceptProposal(value: string, p: ProposalInput): PatchProposal | null {
  if (!value) return null
  const concept = value
  const uplift = p.delta >= 0
  return {
    skillId: 'creative-director',
    type: uplift ? 'add-keyword' : 'tweak-wording',
    old: `Concept generation treats archetype "${concept}" neutrally.`,
    new: uplift
      ? `Seed concept generation with archetype "${concept}" so more pitches explore this direction.`
      : `Retire / down-weight archetype "${concept}" in concept generation.`,
    rationale:
      p.recommendation ||
      `Concepts of type "${concept}" scored ${p.delta.toFixed(2)} composite vs. baseline (n=${p.sampleSize}).`,
    confidence: p.confidence,
    source: 'auto-correlation',
    status: 'proposed',
    createdAt: Date.now(),
  }
}

function modelProposal(value: string, p: ProposalInput): PatchProposal | null {
  if (!value) return null
  const model = value
  const uplift = p.delta >= 0
  return {
    skillId: 'fusion-router',
    type: 'adjust-weight',
    old: `Model routing treats "${model}" neutrally for this domain.`,
    new: uplift
      ? `Route this domain toward model "${model}" (raise its fusion weight).`
      : `Demote model "${model}" for this domain (lower its fusion weight).`,
    rationale:
      p.recommendation ||
      `Model "${model}" scored ${p.delta.toFixed(2)} composite vs. baseline (n=${p.sampleSize}).`,
    confidence: p.confidence,
    source: 'auto-correlation',
    status: 'proposed',
    createdAt: Date.now(),
  }
}

function genericProposal(kind: string, p: ProposalInput): PatchProposal {
  return {
    skillId: `skill:${kind || 'unknown'}`,
    type: 'tweak-wording',
    old: `No adjustment for "${kind}" correlations yet.`,
    new: `Review skill behaviour around the "${kind}" factor that tracked with higher scores.`,
    rationale:
      p.recommendation ||
      `A "${kind}" correlation cleared the confidence threshold (${p.confidence.toFixed(2)}) but no specific builder exists; flag for manual tuning.`,
    confidence: p.confidence,
    source: 'auto-correlation',
    status: 'proposed',
    createdAt: Date.now(),
  }
}

// ─── Map a spec ProposalType onto the load-bearing PatchType ────────────────
//
// I4's SkillPatch.type vocabulary is { guidance, token, recipe, weight,
// guardrail }. We project each spec ProposalType onto the closest one so the
// applier's logging ("skill/type") stays meaningful.

function projectionType(t: ProposalType): PatchType {
  switch (t) {
    case 'adjust-weight':
      return 'weight'
    case 'add-keyword':
    case 'tweak-wording':
      return 'guidance'
    case 'add-rule':
    case 'modify-threshold':
      return 'guardrail'
    default:
      return 'guidance'
  }
}

/** Fold a spec-shape PatchProposal into a load-bearing SkillPatch. */
function proposalToPatch(prop: PatchProposal): SkillPatch {
  return makePatch({
    skill: prop.skillId,
    type: projectionType(prop.type),
    summary: prop.rationale.slice(0, 240),
    confidence: prop.confidence,
    sampleSize: 0, // sampleSize lives on the correlation, not the proposal;
    // we mirror it into payload so the applier still has it for display.
    payload: {
      proposalType: prop.type,
      old: prop.old,
      new: prop.new,
      rationale: prop.rationale,
      source: prop.source,
      proposalStatus: prop.status,
      createdAtMs: prop.createdAt,
    },
  })
}

// ─── Core API: proposePatches ──────────────────────────────────────────────

/**
 * For each correlation with confidence >= PROPOSAL_CONFIDENCE_THRESHOLD (0.6),
 * generate a targeted SkillPatch. Correlations below threshold, or too vague to
 * act on, are skipped silently. Never throws — returns [] on any failure.
 *
 * The returned SkillPatch[] carries the spec's {old, new, rationale, source,
 * type} verbatim inside each patch's `payload`, so callers can recover the full
 * proposal surface while I4 consumes the patches directly.
 */
export async function proposePatches(
  correlations: Correlation[],
): Promise<SkillPatch[]> {
  const patches: SkillPatch[] = []
  if (!Array.isArray(correlations)) return patches

  for (const raw of correlations) {
    try {
      if (!raw || typeof raw !== 'object') continue
      const c = parseCorrelation(raw)
      if (c.confidence < PROPOSAL_CONFIDENCE_THRESHOLD) continue

      const input: ProposalInput = {
        delta: c.delta,
        confidence: c.confidence,
        sampleSize: c.sampleSize,
        recommendation: c.recommendation,
      }

      let proposal: PatchProposal | null = null
      switch (c.kind) {
        case 'palette':
          proposal = paletteProposal(c.value, input)
          break
        case 'auditFindings':
        case 'audit':
          proposal = auditProposal(c.value, input)
          break
        case 'concept':
          proposal = conceptProposal(c.value, input)
          break
        case 'model':
          proposal = modelProposal(c.value, input)
          break
        default:
          proposal = genericProposal(c.kind, input)
      }

      if (!proposal) continue
      const patch = proposalToPatch(proposal)
      // Mirror the correlation's sample support onto the patch so I4's gate
      // (which reads patch.sampleSize) works on real evidence.
      patch.sampleSize = c.sampleSize
      patches.push(patch)
    } catch {
      /* one malformed correlation must not abort the batch */
    }
  }

  return patches
}

// ─── Storage ────────────────────────────────────────────────────────────────

const DEFAULT_PATH = process.env.PATCHES_PATH || './data/patches.jsonl'

function patchesPath(): string {
  return process.env.PATCHES_PATH || DEFAULT_PATH
}

/** Ensure the directory for the JSONL store exists (best effort). */
function ensureDir(path: string): void {
  const dir = dirname(path)
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      /* race / perms — the append below still tries */
    }
  }
}

/**
 * Read all proposed-but-not-applied patches from data/patches.jsonl
 * (status === "proposed"). Never throws — returns [] on any failure.
 */
export async function getPendingPatches(): Promise<SkillPatch[]> {
  try {
    const path = patchesPath()
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf8')
    const out: SkillPatch[] = []
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as SkillPatch
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.id === 'string' &&
          parsed.status === 'proposed'
        ) {
          out.push(parsed)
        }
      } catch {
        /* skip malformed line — never let one bad row abort the read */
      }
    }
    return out
  } catch (e) {
    console.warn(
      '[patch-proposer] getPendingPatches failed:',
      e instanceof Error ? e.message : e,
    )
    return []
  }
}

/**
 * Append a single patch to data/patches.jsonl. Best-effort mkdir; never throws.
 * The patch is written exactly as supplied (status left to the caller — usually
 * "proposed"); the approval gate in patch-applier (I4) decides any transition.
 */
export async function savePatch(patch: SkillPatch): Promise<void> {
  try {
    const path = patchesPath()
    ensureDir(path)
    appendFileSync(path, JSON.stringify(patch) + '\n', 'utf8')
  } catch (e) {
    console.warn(
      '[patch-proposer] savePatch failed:',
      e instanceof Error ? e.message : e,
    )
  }
}
