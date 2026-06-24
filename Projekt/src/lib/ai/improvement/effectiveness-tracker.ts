/**
 * effectiveness-tracker.ts — I5: did a patch actually HELP?
 *
 * The improvement layer's closed loop, part 1 (measurement). Every patch the
 * applier (I4) ships carries a *before* composite (the score that motivated
 * it). After enough *after* composites accumulate, this module judges whether
 * the patch was worth it:
 *
 *   trackPatchEffectiveness(patchId, before)  → start a tracking record
 *       (writes a "pending" PatchOutcome to data/patch-outcomes.jsonl)
 *   recordOutcome(patchId, after)             → accumulate a post-patch score
 *       (running average + sampleSize grow on each call)
 *   evaluatePatch(patchId)                    → compute the verdict:
 *       "improved" if avg-after > avg-before + 0.5
 *       "regressed" if avg-after < avg-before - 0.5
 *       else "neutral" — but "pending" until sampleSize >= 3
 *   autoRevertIfRegressed(patchId)            → if verdict is "regressed"
 *       AND sampleSize >= 5, roll the patch back via patch-applier.revertPatch
 *
 * This is what turns the improvement loop from "propose → apply" into
 * "propose → apply → MEASURE → keep-or-revert". Without it, a bad patch
 * ships forever; with it, regressions self-heal.
 *
 * Storage: process.env.PATCH_OUTCOMES_PATH || './data/patch-outcomes.jsonl'
 * (append-only JSONL, rewritten on each accumulate so the running average
 * stays the single source of truth). Never throws — a measurement failure
 * must never break a design response.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { revertPatch } from './patch-applier'

// ─── Public types ──────────────────────────────────────────────────────────

export interface PatchOutcome {
  patchId: string
  beforeComposite: number
  afterComposite: number
  sampleSize: number
  verdict: 'improved' | 'neutral' | 'regressed' | 'pending'
}

// ─── Internal record shape (what actually lives in the JSONL) ───────────────
//
// The JSONL stores the RAW accumulation so the average can be recomputed
// cheaply without re-summing a long tail: we keep the SUM of all after-composites
// seen so far and a COUNT, and `beforeComposite` is the fixed baseline.

interface OutcomeRecord {
  patchId: string
  beforeComposite: number
  afterSum: number
  sampleSize: number
  lastAfter: number
  createdAt: string
  updatedAt: string
}

// ─── Verdict thresholds ────────────────────────────────────────────────────

/** A patch must move the average composite by at least this much (in either
 *  direction) to count as "improved" / "regressed" rather than "neutral". */
const VERDICT_DELTA = 0.5
/** Below this sample count, the verdict stays "pending" — too noisy to judge. */
const MIN_SAMPLES_FOR_VERDICT = 3
/** autoRevertIfRegressed requires this many samples before it will fire, so a
 *  couple of unlucky runs cannot roll back a patch that is fine on average. */
const MIN_SAMPLES_FOR_REVERT = 5

// ─── Storage ────────────────────────────────────────────────────────────────

const DEFAULT_PATH = process.env.PATCH_OUTCOMES_PATH || './data/patch-outcomes.jsonl'

function outcomesPath(): string {
  return process.env.PATCH_OUTCOMES_PATH || DEFAULT_PATH
}

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

function safeNumber(n: unknown): number | null {
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Read + parse every stored outcome record. Never throws. */
function readRecords(): OutcomeRecord[] {
  try {
    const path = outcomesPath()
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf8')
    const out: OutcomeRecord[] = []
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as Partial<OutcomeRecord>
        if (
          parsed &&
          typeof parsed === 'object' &&
          typeof parsed.patchId === 'string'
        ) {
          const before = safeNumber(parsed.beforeComposite)
          const afterSum = safeNumber(parsed.afterSum)
          const sampleSize = safeNumber(parsed.sampleSize)
          if (before !== null && afterSum !== null && sampleSize !== null) {
            out.push({
              patchId: parsed.patchId,
              beforeComposite: before,
              afterSum,
              sampleSize,
              lastAfter: safeNumber(parsed.lastAfter) ?? afterSum / sampleSize,
              createdAt: parsed.createdAt ?? new Date().toISOString(),
              updatedAt: parsed.updatedAt ?? new Date().toISOString(),
            })
          }
        }
      } catch {
        /* skip malformed line — never let one bad row abort the read */
      }
    }
    return out
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] readRecords failed:',
      e instanceof Error ? e.message : e,
    )
    return []
  }
}

/** Rewrite the whole store from a list of records (single writeFileSync). */
function writeRecords(records: OutcomeRecord[]): void {
  try {
    const path = outcomesPath()
    ensureDir(path)
    const body =
      records.map((r) => JSON.stringify(r)).join('\n') + (records.length ? '\n' : '')
    writeFileSync(path, body, 'utf8')
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] writeRecords failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/** Append a single new record (used when seeding). Never throws. */
function appendRecord(record: OutcomeRecord): void {
  try {
    const path = outcomesPath()
    ensureDir(path)
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8')
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] appendRecord failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/** Convert a stored OutcomeRecord into the public PatchOutcome view
 *  (average after-composite + computed verdict). Pure. */
function toOutcome(rec: OutcomeRecord): PatchOutcome {
  const avgAfter = rec.sampleSize > 0 ? rec.afterSum / rec.sampleSize : rec.lastAfter
  return {
    patchId: rec.patchId,
    beforeComposite: rec.beforeComposite,
    afterComposite: round(avgAfter),
    sampleSize: rec.sampleSize,
    verdict: verdictFor(rec.beforeComposite, avgAfter, rec.sampleSize),
  }
}

/** Decide the verdict from raw averages + sample count. Pure. */
function verdictFor(
  before: number,
  avgAfter: number,
  sampleSize: number,
): PatchOutcome['verdict'] {
  if (sampleSize < MIN_SAMPLES_FOR_VERDICT) return 'pending'
  const delta = avgAfter - before
  if (delta > VERDICT_DELTA) return 'improved'
  if (delta < -VERDICT_DELTA) return 'regressed'
  return 'neutral'
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Start tracking a patch. Writes a "pending" PatchOutcome record seeded with
 * the given before-composite (the baseline score that motivated the patch).
 *
 * Idempotent on the patchId: if a record already exists it is left untouched
 * (the caller passed `beforeComposite` once, at apply-time — re-tracking would
 * reset the accumulation). Never throws.
 */
export async function trackPatchEffectiveness(
  patchId: string,
  beforeComposite: number,
): Promise<void> {
  try {
    if (!patchId) return
    const before = safeNumber(beforeComposite)
    if (before === null) return

    const records = readRecords()
    const existing = records.find((r) => r.patchId === patchId)
    if (existing) return // already tracking — never clobber the running average

    const now = new Date().toISOString()
    const record: OutcomeRecord = {
      patchId,
      beforeComposite: before,
      afterSum: 0,
      sampleSize: 0,
      lastAfter: before, // sensible default before any outcome lands
      createdAt: now,
      updatedAt: now,
    }
    appendRecord(record)
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] trackPatchEffectiveness failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/**
 * Accumulate a post-patch composite score for a tracked patch. Updates the
 * running average (via afterSum + sampleSize) and bumps updatedAt. If the patch
 * isn't being tracked yet, the call is a no-op (track first, then record).
 * Never throws.
 */
export async function recordOutcome(
  patchId: string,
  afterComposite: number,
): Promise<void> {
  try {
    if (!patchId) return
    const after = safeNumber(afterComposite)
    if (after === null) return

    const records = readRecords()
    const idx = records.findIndex((r) => r.patchId === patchId)
    if (idx < 0) return // not tracked — nothing to accumulate into

    const prev = records[idx]
    records[idx] = {
      ...prev,
      afterSum: prev.afterSum + after,
      sampleSize: prev.sampleSize + 1,
      lastAfter: after,
      updatedAt: new Date().toISOString(),
    }
    writeRecords(records)
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] recordOutcome failed:',
      e instanceof Error ? e.message : e,
    )
  }
}

/**
 * Read the accumulated outcomes for a patch and compute its verdict.
 *
 * Verdict rules:
 *   sampleSize < 3      → "pending" (too few samples to judge)
 *   avg-after > before + 0.5 → "improved"
 *   avg-after < before - 0.5 → "regressed"
 *   otherwise           → "neutral"
 *
 * If the patch has never been tracked, returns a "pending" outcome seeded with
 * a 0 baseline (so callers always get a well-formed PatchOutcome). Never throws.
 */
export async function evaluatePatch(patchId: string): Promise<PatchOutcome> {
  try {
    if (!patchId) {
      return zeroOutcome('')
    }
    const records = readRecords()
    const rec = records.find((r) => r.patchId === patchId)
    if (!rec) {
      // Not tracked yet — return a neutral pending outcome rather than throwing.
      return { ...zeroOutcome(patchId), beforeComposite: 0 }
    }
    return toOutcome(rec)
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] evaluatePatch failed:',
      e instanceof Error ? e.message : e,
    )
    return zeroOutcome(patchId)
  }
}

/**
 * If a patch has regressed on enough samples, roll it back via patch-applier's
 * revertPatch. Returns true only when a revert actually happened.
 *
 * Gate: verdict === "regressed" AND sampleSize >= 5. The sample floor is
 * deliberately higher than evaluatePatch's floor (3) because reverting is a
 * destructive action — we want real confidence the patch hurt before undoing
 * it. Never throws.
 */
export async function autoRevertIfRegressed(patchId: string): Promise<boolean> {
  try {
    if (!patchId) return false
    const outcome = await evaluatePatch(patchId)
    if (outcome.verdict !== 'regressed') return false
    if (outcome.sampleSize < MIN_SAMPLES_FOR_REVERT) return false

    await revertPatch(patchId)
    console.info(
      `[effectiveness-tracker] AUTO-REVERT ${patchId}: regressed by ` +
        `${(outcome.beforeComposite - outcome.afterComposite).toFixed(2)} composite ` +
        `(before ${outcome.beforeComposite} → after ${outcome.afterComposite}, n=${outcome.sampleSize}).`,
    )
    return true
  } catch (e) {
    console.warn(
      '[effectiveness-tracker] autoRevertIfRegressed failed:',
      e instanceof Error ? e.message : e,
    )
    return false
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function zeroOutcome(patchId: string): PatchOutcome {
  return {
    patchId,
    beforeComposite: 0,
    afterComposite: 0,
    sampleSize: 0,
    verdict: 'pending',
  }
}
