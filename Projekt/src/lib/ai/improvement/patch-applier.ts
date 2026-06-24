/**
 * patch-applier.ts — Approval-gated patch lifecycle (I4).
 *
 * A proposed SkillPatch is only auto-applied when it clears BOTH gates:
 *   - confidence >= AUTO_APPLY_THRESHOLD (0.8), AND
 *   - sampleSize  >= 5
 * Anything softer is left as "proposed" and waits for explicit human
 * approvePatch() / rejectPatch(). An applied patch can be rolled back with
 * revertPatch() if its real-world effectiveness later drops.
 *
 * Storage: process.env.PATCHES_PATH || './data/patches.jsonl' (append-only
 * JSONL, rebuilt on mutation). Every transition bumps `version` and stamps
 * `updatedAt`. Never throws — a patch lifecycle failure must never break a
 * design response; callers see { applied: false, reason } instead.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { SkillPatch } from './patch-proposer'

export const AUTO_APPLY_THRESHOLD = 0.8
const MIN_SAMPLE_SIZE = 5

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
      /* race / perms — the write below still tries */
    }
  }
}

/** Read + parse every stored patch. Never throws. */
export function readPatches(): SkillPatch[] {
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
        if (parsed && typeof parsed === 'object' && typeof parsed.id === 'string') {
          out.push(parsed)
        }
      } catch {
        /* skip malformed line */
      }
    }
    return out
  } catch (e) {
    console.warn(
      '[patch-applier] readPatches failed:',
      e instanceof Error ? e.message : e,
    )
    return []
  }
}

/**
 * Rewrite the whole store from a list of patches (atomic-ish, single
 * writeFileSync). Used by every mutation so the JSONL stays consistent with
 * the latest status of each patch id. Never throws.
 */
function writePatches(patches: SkillPatch[]): void {
  try {
    const path = patchesPath()
    ensureDir(path)
    const body = patches.map((p) => JSON.stringify(p)).join('\n') + (patches.length ? '\n' : '')
    writeFileSync(path, body, 'utf8')
  } catch (e) {
    console.warn(
      '[patch-applier] writePatches failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/** Append a single new patch record (used when seeding the store). Never throws. */
export function appendPatch(patch: SkillPatch): void {
  try {
    const path = patchesPath()
    ensureDir(path)
    appendFileSync(path, JSON.stringify(patch) + '\n', 'utf8')
  } catch (e) {
    console.warn(
      '[patch-applier] appendPatch failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/**
 * Apply (or hold) a patch according to the approval gate.
 *
 * Auto-applies when confidence >= AUTO_APPLY_THRESHOLD AND sampleSize >= 5.
 * Otherwise leaves the patch as "proposed" for human review. The real skill
 * rewrite is deferred (logged here); this function owns the lifecycle bookkeeping.
 * Never throws.
 */
export async function applyPatch(
  patch: SkillPatch,
): Promise<{ applied: boolean; reason: string }> {
  try {
    const stored = readPatches()
    const idx = stored.findIndex((p) => p.id === patch.id)

    const eligible =
      patch.confidence >= AUTO_APPLY_THRESHOLD && patch.sampleSize >= MIN_SAMPLE_SIZE

    if (eligible) {
      const updated: SkillPatch = {
        ...patch,
        status: 'applied',
        version: (patch.version ?? 1) + 1,
        updatedAt: new Date().toISOString(),
        reason: `auto-applied (confidence=${patch.confidence.toFixed(3)}, sampleSize=${patch.sampleSize})`,
      }
      if (idx >= 0) {
        stored[idx] = updated
        writePatches(stored)
      } else {
        appendPatch(updated)
      }
      // Full skill-rewriting lands later; for now we log the intent so the
      // observability surface (/api/stats) can see what was applied.
      console.info(
        `[patch-applier] AUTO-APPLY ${updated.id} (${updated.skill}/${updated.type}): ${updated.summary}`,
      )
      return {
        applied: true,
        reason: `auto-applied: confidence ${patch.confidence.toFixed(3)} >= ${AUTO_APPLY_THRESHOLD} and sampleSize ${patch.sampleSize} >= ${MIN_SAMPLE_SIZE}`,
      }
    }

    // Below the bar — leave as proposed for human review.
    const pending: SkillPatch = { ...patch, status: 'proposed' }
    if (idx >= 0) {
      stored[idx] = pending
      writePatches(stored)
    } else {
      appendPatch(pending)
    }
    const why =
      patch.confidence < AUTO_APPLY_THRESHOLD
        ? `confidence ${patch.confidence.toFixed(3)} < threshold ${AUTO_APPLY_THRESHOLD}`
        : `sampleSize ${patch.sampleSize} < minimum ${MIN_SAMPLE_SIZE}`
    return { applied: false, reason: `left pending for review: ${why}` }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { applied: false, reason: `applyPatch error: ${msg}` }
  }
}

/**
 * Walk every pending patch and auto-apply the eligible ones.
 * Returns counts of auto-applied vs left-pending. Never throws.
 */
export async function processPendingPatches(): Promise<{
  autoApplied: number
  leftPending: number
}> {
  try {
    const stored = readPatches()
    const pending = stored.filter((p) => p.status === 'proposed')
    if (pending.length === 0) return { autoApplied: 0, leftPending: 0 }

    let autoApplied = 0
    let leftPending = 0
    let mutated = false

    for (let i = 0; i < stored.length; i++) {
      const p = stored[i]
      if (p.status !== 'proposed') continue
      const eligible =
        p.confidence >= AUTO_APPLY_THRESHOLD && p.sampleSize >= MIN_SAMPLE_SIZE
      if (eligible) {
        stored[i] = {
          ...p,
          status: 'applied',
          version: (p.version ?? 1) + 1,
          updatedAt: new Date().toISOString(),
          reason: `auto-applied via processPendingPatches (confidence=${p.confidence.toFixed(3)}, sampleSize=${p.sampleSize})`,
        }
        console.info(
          `[patch-applier] AUTO-APPLY ${stored[i].id} (${stored[i].skill}/${stored[i].type}): ${stored[i].summary}`,
        )
        autoApplied++
        mutated = true
      } else {
        leftPending++
      }
    }

    if (mutated) writePatches(stored)
    return { autoApplied, leftPending }
  } catch (e) {
    console.warn(
      '[patch-applier] processPendingPatches failed:',
      e instanceof Error ? e.message : e,
    )
    return { autoApplied: 0, leftPending: 0 }
  }
}

/** Transition a pending patch to "approved" (human reviewed + approved). */
export async function approvePatch(patchId: string): Promise<void> {
  const stored = readPatches()
  const idx = stored.findIndex((p) => p.id === patchId)
  if (idx < 0) {
    console.warn(`[patch-applier] approvePatch: patch ${patchId} not found`)
    return
  }
  stored[idx] = {
    ...stored[idx],
    status: 'approved',
    version: (stored[idx].version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
    reason: 'approved by user',
  }
  writePatches(stored)
}

/** Transition a pending patch to "rejected" (human reviewed + rejected). */
export async function rejectPatch(patchId: string): Promise<void> {
  const stored = readPatches()
  const idx = stored.findIndex((p) => p.id === patchId)
  if (idx < 0) {
    console.warn(`[patch-applier] rejectPatch: patch ${patchId} not found`)
    return
  }
  stored[idx] = {
    ...stored[idx],
    status: 'rejected',
    version: (stored[idx].version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
    reason: 'rejected by user',
  }
  writePatches(stored)
}

/** Revert an applied/approved patch (e.g. effectiveness dropped). */
export async function revertPatch(patchId: string): Promise<void> {
  const stored = readPatches()
  const idx = stored.findIndex((p) => p.id === patchId)
  if (idx < 0) {
    console.warn(`[patch-applier] revertPatch: patch ${patchId} not found`)
    return
  }
  const prev = stored[idx]
  if (prev.status !== 'applied' && prev.status !== 'approved') {
    console.warn(
      `[patch-applier] revertPatch: patch ${patchId} not in applied/approved (status=${prev.status})`,
    )
    return
  }
  stored[idx] = {
    ...prev,
    status: 'reverted',
    version: (prev.version ?? 1) + 1,
    updatedAt: new Date().toISOString(),
    reason: 'reverted — effectiveness dropped or rolled back by user',
  }
  writePatches(stored)
}
