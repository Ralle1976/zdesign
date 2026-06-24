/**
 * feedback-collector.ts — Append-only JSONL feedback store (I1).
 *
 * The improvement layer's *input*. Every skill invocation that ships a design
 * (or fails to) appends one FeedbackSignal here. Downstream consumers — the
 * GEPA evolver, the DesignLesson learner, the critique-theater replay — read
 * these back to learn WHICH skill/model/palette/topic combos produce high-
 * composite output and which under-perform.
 *
 * Storage: process.env.FEEDBACK_PATH || './data/feedback.jsonl'
 * Never throws — every public function wraps in try/catch and degrades
 * gracefully (a feedback-collection failure must never break a design response,
 * exactly like trace-store / logger before it).
 *
 * Sibling to trace-store.ts (the *design* trace) and logger.ts (DB-backed
 * observability). This is the *skill-outcome* signal layer.
 */
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export interface FeedbackSignal {
  timestamp: number
  /** Skill that emitted the signal, e.g. 'art-direction' | 'panelists' | 'critique'. */
  skillType: string
  /** Stable per-invocation id (correlates with trace-store entries). */
  skillId: string
  outcome: 'success' | 'failure' | 'neutral'
  metrics: {
    /** 0-100 composite quality score from the audit / panelists. */
    composite?: number
    /** Number of audit findings (lint + a11y + design-rule violations). */
    auditFindings?: number
    /** Free-form user action signal, e.g. 'accepted' | 'regenerated' | 'edited-manually' | 'exported'. */
    userAction?: string
    /** Total token cost of the invocation (in + out, cached excluded). */
    tokenCost?: number
    /** Wall-clock latency in ms. */
    latencyMs?: number
  }
  context: {
    topic?: string
    palette?: string
    concept?: string
    model?: string
  }
}

export interface FeedbackFilter {
  skillType?: string
  outcome?: string
  /** Inclusive lower-bound timestamp (epoch ms). */
  since?: number
}

export interface FeedbackStats {
  total: number
  /** Fraction of signals with outcome === 'success' (0-1). */
  successRate: number
  /** Mean composite across signals that carried one (0 if none). */
  avgComposite: number
  bySkill: Record<
    string,
    { count: number; successRate: number; avgComposite: number }
  >
}

const DEFAULT_PATH = './data/feedback.jsonl'

function feedbackPath(): string {
  return process.env.FEEDBACK_PATH || DEFAULT_PATH
}

/** Coerce an unknown value to a finite number, else fallback. */
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

/** Coerce to trimmed string with a max length to keep the file bounded. */
function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** Normalize a raw parsed object into a trusted FeedbackSignal (or null if unfixable). */
function normalize(raw: unknown): FeedbackSignal | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const outcome = r.outcome
  const normalizedOutcome =
    outcome === 'success' || outcome === 'failure' || outcome === 'neutral'
      ? outcome
      : 'neutral'

  const m = (r.metrics && typeof r.metrics === 'object'
    ? r.metrics
    : {}) as Record<string, unknown>
  const c = (r.context && typeof r.context === 'object'
    ? r.context
    : {}) as Record<string, unknown>

  const signal: FeedbackSignal = {
    timestamp: num(r.timestamp, Date.now()),
    skillType: str(r.skillType, 120) || 'unknown',
    skillId: str(r.skillId, 200),
    outcome: normalizedOutcome,
    metrics: {
      ...(typeof m.composite === 'number' && Number.isFinite(m.composite)
        ? { composite: m.composite }
        : {}),
      ...(typeof m.auditFindings === 'number' &&
      Number.isFinite(m.auditFindings)
        ? { auditFindings: m.auditFindings }
        : {}),
      ...(typeof m.userAction === 'string' && m.userAction.length > 0
        ? { userAction: str(m.userAction, 120) }
        : {}),
      ...(typeof m.tokenCost === 'number' && Number.isFinite(m.tokenCost)
        ? { tokenCost: m.tokenCost }
        : {}),
      ...(typeof m.latencyMs === 'number' && Number.isFinite(m.latencyMs)
        ? { latencyMs: m.latencyMs }
        : {}),
    },
    context: {
      ...(typeof c.topic === 'string' && c.topic.length > 0
        ? { topic: str(c.topic, 300) }
        : {}),
      ...(typeof c.palette === 'string' && c.palette.length > 0
        ? { palette: str(c.palette, 200) }
        : {}),
      ...(typeof c.concept === 'string' && c.concept.length > 0
        ? { concept: str(c.concept, 300) }
        : {}),
      ...(typeof c.model === 'string' && c.model.length > 0
        ? { model: str(c.model, 120) }
        : {}),
    },
  }

  return signal
}

/**
 * Append one feedback signal to the JSONL store.
 * Validates + coerces every field; never throws.
 */
export async function recordFeedback(signal: FeedbackSignal): Promise<void> {
  try {
    const normalized = normalize(signal)
    if (!normalized) return

    const path = feedbackPath()
    const dir = dirname(path)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        /* dir race / perms — best effort, append below will still try */
      }
    }
    appendFileSync(path, JSON.stringify(normalized) + '\n', 'utf8')
  } catch (e) {
    console.warn(
      '[feedback-collector] recordFeedback failed:',
      e instanceof Error ? e.message : e
    )
  }
}

/**
 * Read + parse the JSONL store, optionally filtered.
 * Returns [] on any error (never throws).
 */
export async function readFeedback(
  filter?: FeedbackFilter
): Promise<FeedbackSignal[]> {
  try {
    const path = feedbackPath()
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf8')
    const lines = raw.split(/\r?\n/)
    const out: FeedbackSignal[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const signal = normalize(JSON.parse(trimmed))
        if (!signal) continue

        if (filter?.skillType && signal.skillType !== filter.skillType) continue
        if (filter?.outcome && signal.outcome !== filter.outcome) continue
        if (
          typeof filter?.since === 'number' &&
          Number.isFinite(filter.since) &&
          signal.timestamp < filter.since
        ) {
          continue
        }
        out.push(signal)
      } catch {
        /* skip malformed line — never let one bad row abort the read */
      }
    }
    return out
  } catch (e) {
    console.warn(
      '[feedback-collector] readFeedback failed:',
      e instanceof Error ? e.message : e
    )
    return []
  }
}

/**
 * Aggregate the store into summary statistics.
 * Never throws; returns zeroed stats on any error.
 */
export async function getFeedbackStats(): Promise<FeedbackStats> {
  const empty: FeedbackStats = {
    total: 0,
    successRate: 0,
    avgComposite: 0,
    bySkill: {},
  }

  try {
    const signals = await readFeedback()
    if (signals.length === 0) return empty

    let successes = 0
    let compositeSum = 0
    let compositeCount = 0

    const bySkill: FeedbackStats['bySkill'] = {}

    for (const s of signals) {
      if (s.outcome === 'success') successes++

      const c = s.metrics.composite
      if (typeof c === 'number' && Number.isFinite(c)) {
        compositeSum += c
        compositeCount++
      }

      // Per-skill accumulation.
      const key = s.skillType || 'unknown'
      if (!bySkill[key]) {
        bySkill[key] = { count: 0, successRate: 0, avgComposite: 0 }
      }
      const bucket = bySkill[key]
      bucket.count++
      // Track running sums privately via closure-augmented fields.
      ;(bucket as unknown as { _succ: number })._succ =
        ((bucket as unknown as { _succ: number })._succ || 0) +
        (s.outcome === 'success' ? 1 : 0)
      ;(bucket as unknown as { _compSum: number })._compSum =
        ((bucket as unknown as { _compSum: number })._compSum || 0) +
        (typeof c === 'number' && Number.isFinite(c) ? c : 0)
      ;(bucket as unknown as { _compCount: number })._compCount =
        ((bucket as unknown as { _compCount: number })._compCount || 0) +
        (typeof c === 'number' && Number.isFinite(c) ? 1 : 0)
    }

    // Finalize per-skill rates (strip private fields).
    for (const key of Object.keys(bySkill)) {
      const b = bySkill[key]
      const ext = b as unknown as {
        _succ: number
        _compSum: number
        _compCount: number
      }
      b.successRate = b.count > 0 ? ext._succ / b.count : 0
      b.avgComposite =
        ext._compCount > 0 ? ext._compSum / ext._compCount : 0
      delete ext._succ
      delete ext._compSum
      delete ext._compCount
    }

    return {
      total: signals.length,
      successRate: successes / signals.length,
      avgComposite: compositeCount > 0 ? compositeSum / compositeCount : 0,
      bySkill,
    }
  } catch (e) {
    console.warn(
      '[feedback-collector] getFeedbackStats failed:',
      e instanceof Error ? e.message : e
    )
    return empty
  }
}
