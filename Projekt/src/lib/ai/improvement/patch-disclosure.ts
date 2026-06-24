/**
 * patch-disclosure.ts — I7: keep the context FLAT no matter how many patches.
 *
 * The Hermes principle the base progressive-disclosure.ts applies to skills
 * and recipes, applied here to PATCHES. As the improvement loop accumulates
 * patches (some auto-applied, some pending, some reverted), dumping them all
 * into the system prompt would balloon context. Instead:
 *
 *   Level 0 — patch summary (~50 tokens). Always in context.
 *             "palette-gold (auto, conf 0.83)" — one line per patch.
 *   Level 1 — full patch details: old / new / rationale / status / version.
 *             Loaded on demand when the agent needs to reason about a patch.
 *   Level 2 — effectiveness tracking data: before / after / sampleSize /
 *             verdict (from effectiveness-tracker, I5). Loaded only for
 *             debugging or "why did this patch ship / get reverted" questions.
 *
 * Three pure, dependency-free functions:
 *   patchesToDisclosable(patches)  → wrap every SkillPatch as a Disclosable
 *   patchIndex(patches)            → ALL patches at L0, compact flat string
 *                                    for the system prompt
 *   loadPatchDetail(patchId, ...)  → L1 (or L2 when an outcome is attached)
 *                                    for ONE patch
 *
 * This module NEVER reads disk — the caller owns I/O (it passes the patches
 * array in, and optionally a PatchOutcome map for L2). That keeps these
 * functions pure and testable, and matches the rest of the improvement layer's
 * "never throw on I/O" contract by side-stepping I/O entirely.
 */
import type { SkillPatch } from './patch-proposer'
import type { Disclosable, DisclosureLevel } from '../memory/progressive-disclosure'
import { atLevel } from '../memory/progressive-disclosure'
import type { PatchOutcome } from './effectiveness-tracker'

// ─── Public types ──────────────────────────────────────────────────────────

/**
 * A patch surfaced through the 3-level progressive-disclosure system.
 * Extends the base Disclosable so it plugs straight into atLevel() /
 * listForIndex() / loadForTrigger() if a caller wants to unify it with the
 * skill index.
 *
 *   level0 — patch summary (~50 tokens): "id-slug (status, conf 0.83)"
 *   level1 — full patch: old / new / rationale / status / version
 *   level2 — effectiveness data: before / after / sampleSize / verdict
 *            (empty string when no outcome is available — L2 then falls back
 *             to L1 via atLevel's contract)
 */
export interface PatchDisclosable extends Disclosable {
  /** The patch id this disclosure wraps. */
  patchId: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Short, prompt-safe slug from a patch id (uuids are noisy at L0). We prefer
 *  the skill name when present, then the type, then the first 8 chars of the
 *  id. Always non-empty. */
function slug(patch: SkillPatch): string {
  const skill = (patch.skill ?? '').trim()
  if (skill) return skill
  const type = (patch.type ?? '').trim()
  if (type) return type
  return (patch.id ?? 'patch').slice(0, 8)
}

/** Compact status tag for L0. Auto-applied patches show "(auto)"; others show
 *  their status verbatim so the model knows what's live vs proposed. */
function statusTag(patch: SkillPatch): string {
  const auto =
    patch.reason && /auto-applied/i.test(patch.reason) ? 'auto' : patch.status
  return String(auto ?? patch.status ?? 'unknown')
}

/** Truncate to a token-ish budget by characters (rough: 1 token ≈ 4 chars). */
function truncate(s: string, maxChars: number): string {
  const t = (s ?? '').trim().replace(/\s+/g, ' ')
  if (t.length <= maxChars) return t
  return t.slice(0, maxChars - 1).trimEnd() + '…'
}

/** Pull the spec-shape old/new/rationale out of a patch's payload (where
 *  patch-proposer.fold-proposal stores them) with graceful fallbacks. */
function proposalFields(patch: SkillPatch): {
  old: string
  new: string
  rationale: string
} {
  const p = (patch.payload ?? {}) as Record<string, unknown>
  return {
    old: typeof p.old === 'string' ? p.old : '',
    new: typeof p.new === 'string' ? p.new : '',
    rationale:
      typeof p.rationale === 'string'
        ? p.rationale
        : typeof patch.summary === 'string'
          ? patch.summary
          : '',
  }
}

/** Format a confidence 0-1 as a 2-decimal string, or '?' if not numeric. */
function conf(n: unknown): string {
  return typeof n === 'number' && Number.isFinite(n)
    ? n.toFixed(2)
    : '?'
}

// ─── Level builders ────────────────────────────────────────────────────────

function level0(patch: SkillPatch): string {
  return `${slug(patch)} (${statusTag(patch)}, conf ${conf(patch.confidence)})`
}

function level1(patch: SkillPatch): string {
  const f = proposalFields(patch)
  const lines: string[] = []
  lines.push(`### Patch: ${slug(patch)}  [${statusTag(patch)}]`)
  lines.push(`- id: ${patch.id}`)
  lines.push(`- skill: ${patch.skill || '(none)'}  ·  type: ${patch.type}`)
  lines.push(`- confidence: ${conf(patch.confidence)}  ·  sampleSize: ${patch.sampleSize}`)
  lines.push(`- version: ${patch.version ?? 1}  ·  updatedAt: ${patch.updatedAt ?? '?'}`)
  if (f.old) lines.push(`- old: ${truncate(f.old, 220)}`)
  if (f.new) lines.push(`- new: ${truncate(f.new, 220)}`)
  if (f.rationale) lines.push(`- rationale: ${truncate(f.rationale, 320)}`)
  if (patch.reason) lines.push(`- lastTransition: ${truncate(patch.reason, 200)}`)
  return lines.join('\n')
}

function level2(patch: SkillPatch, outcome?: PatchOutcome): string {
  const l1 = level1(patch)
  if (!outcome) return l1 // no effectiveness data — fall back to L1
  const delta = outcome.afterComposite - outcome.beforeComposite
  const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)
  const lines: string[] = [
    l1,
    '',
    `### Effectiveness`,
    `- verdict: ${outcome.verdict}`,
    `- before: ${outcome.beforeComposite}  →  after: ${outcome.afterComposite}  (Δ ${deltaStr})`,
    `- sampleSize: ${outcome.sampleSize}`,
  ]
  return lines.join('\n')
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Wrap a list of patches as PatchDisclosable. `outcomes` is an optional map of
 * patchId → PatchOutcome (from effectiveness-tracker) used to populate L2.
 *
 * Pure / synchronous; never throws on malformed patches (skips them). An empty
 * / non-array input yields [].
 */
export function patchesToDisclosable(
  patches: SkillPatch[],
  outcomes?: Record<string, PatchOutcome>,
): PatchDisclosable[] {
  if (!Array.isArray(patches)) return []
  const map = outcomes && typeof outcomes === 'object' ? outcomes : {}
  const out: PatchDisclosable[] = []
  for (const patch of patches) {
    try {
      if (!patch || typeof patch !== 'object' || typeof patch.id !== 'string') continue
      const outcome = map[patch.id]
      out.push({
        id: patch.id,
        patchId: patch.id,
        level0: level0(patch),
        level1: level1(patch),
        level2: level2(patch, outcome),
      })
    } catch {
      /* one malformed patch must not abort the batch */
    }
  }
  return out
}

/**
 * Compact index of ALL patches at L0, for the system prompt.
 *
 * Output shape:
 *   "Aktive Patches: palette-gold (auto, conf 0.83), a11y-floor (auto, conf 0.81)"
 *
 * Only patches that are LIVE (applied / approved) are included by default —
 * proposed/reverted/rejected patches are noise in the index. Pass
 * `{ includeAll: true }` to surface every patch regardless of status.
 * Returns '' when there is nothing to show (so the caller can skip injecting).
 */
export function patchIndex(
  patches: SkillPatch[],
  opts?: { includeAll?: boolean },
): string {
  if (!Array.isArray(patches) || patches.length === 0) return ''
  const includeAll = opts?.includeAll === true
  const live = new Set<SkillPatch['status']>(['applied', 'approved'])
  const picked = patches.filter((p) => {
    if (!p || typeof p !== 'object' || typeof p.id !== 'string') return false
    return includeAll || live.has(p.status)
  })
  if (picked.length === 0) return ''
  const items = picked.map((p) => level0(p)).join(', ')
  return `Aktive Patches: ${items}`
}

/**
 * Return the detail (L1, or L2 when an outcome is attached) for ONE patch.
 *
 * Looks the patch up by id in the supplied array. If `outcomes` carries an
 * entry for this patchId, the L2 view (with effectiveness data) is returned;
 * otherwise the L1 view. Returns '' when the patchId is unknown so the caller
 * can no-op cleanly.
 */
export function loadPatchDetail(
  patchId: string,
  patches: SkillPatch[],
  outcomes?: Record<string, PatchOutcome>,
): string {
  if (!patchId || !Array.isArray(patches)) return ''
  const patch = patches.find((p) => p && p.id === patchId)
  if (!patch) return ''
  const map = outcomes && typeof outcomes === 'object' ? outcomes : {}
  const outcome = map[patchId]
  const level: DisclosureLevel = outcome ? 2 : 1
  return atLevel(
    {
      id: patch.id,
      level0: level0(patch),
      level1: level1(patch),
      level2: level2(patch, outcome),
    },
    level,
  )
}
