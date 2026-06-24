/**
 * correlation-engine.ts — Improvement Loop I2: finds the patterns behind
 * strong vs. weak designs.
 *
 * Reads ALL FeedbackSignals collected by the feedback-collector (I1) and
 * mines them for correlations: which palette, which concept, which model,
 * which audit-finding regime tracks with higher composite scores. The
 * output is a ranked list of {factor, effect, confidence, recommendation}
 * that the GEPA optimizer, the DesignLesson writer, and the /api/stats
 * insight surface consume to make the agent's choices less arbitrary over
 * time.
 *
 * Statistical posture: deliberately simple. We are not doing science here,
 * we are triaging heuristics for a design agent. Every correlation is a
 * group mean delta (in-group avg composite vs. out-group avg composite)
 * gated by a minimum sample size (>= MIN_SAMPLE) and effect size
 * (>= MIN_DELTA). Confidence = |delta| weighted by sample support, scaled
 * to [0,1].
 *
 * FeedbackSignal shape (owned by ./feedback-collector): the composite lives
 * at `signal.metrics.composite` (0-100 scale), audit-finding count at
 * `signal.metrics.auditFindings`, and {topic, palette, concept, model} at
 * `signal.context`. This module is defensive about every one of those being
 * missing — a partial signal simply does not contribute to that factor.
 *
 * Never throws — a correlation-engine failure must never break a design
 * response or the stats surface. Every public function degrades to [].
 */

import type { FeedbackSignal } from './feedback-collector';

export type { FeedbackSignal };

// ---------------------------------------------------------------------------
// Reader wiring.
//
// Production reads from the real feedback-collector.readFeedback(). Tests
// inject a mock via setFeedbackReader(). The indirection is what makes the
// engine unit-testable without the JSONL store / DB.
// ---------------------------------------------------------------------------

export type ReadFeedbackFn = () => Promise<FeedbackSignal[]>;

let readFeedbackRef: ReadFeedbackFn | null = null;

/**
 * Install (or override) the feedback reader. Production wires the real
 * feedback-collector.readFeedback; tests inject a mock. Pass null to reset.
 */
export function setFeedbackReader(fn: ReadFeedbackFn | null): void {
  readFeedbackRef = fn;
}

/**
 * Best-effort load of the real reader from the feedback-collector (I1).
 * Called on first use; a missing/broken collector leaves us with no reader
 * and readAll() returns [].
 */
async function loadDefaultReader(): Promise<void> {
  if (readFeedbackRef) return;
  try {
    // Static-looking dynamic import: keeps the module loadable even if the
    // collector is mid-refactor, and avoids a hard cycle at import time.
    const mod = (await import('./feedback-collector')) as {
      readFeedback?: unknown;
    };
    const fn = mod.readFeedback;
    if (typeof fn === 'function') {
      readFeedbackRef = fn as ReadFeedbackFn;
    }
  } catch {
    // Collector not present / broken — engine is inert until
    // setFeedbackReader() is called. Not an error.
  }
}

/** Read all feedback signals via the wired reader. Never throws. */
async function readAll(): Promise<FeedbackSignal[]> {
  try {
    await loadDefaultReader();
    if (!readFeedbackRef) return [];
    const out = await readFeedbackRef();
    return Array.isArray(out) ? out : [];
  } catch (e) {
    console.warn(
      '[correlation-engine] readAll failed:',
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

// ---------------------------------------------------------------------------
// Output contract.
// ---------------------------------------------------------------------------

export interface Correlation {
  /** What varied (e.g. "palette:Cormorant", "concept:editorial"). */
  factor: string;
  /** Human-readable effect, e.g. "+8.4 composite vs. baseline". */
  effect: string;
  /** Confidence score in [0,1] — |delta| * sample support, normalized. */
  confidence: number;
  /** Number of in-group signals supporting the correlation. */
  sampleSize: number;
  /** Actionable recommendation for the agent / optimizer. */
  recommendation: string;
}

// ---------------------------------------------------------------------------
// Tuning constants.
//
// composite is 0-100 (panelist-weighted, see feedback-collector). A 1-point
// delta on that scale is noise; 8 points is a real, actionable gap. The
// MIN_DELTA below (8.0) is the threshold at which we consider a group mean
// difference worth reporting.
// ---------------------------------------------------------------------------

/** Minimum in-group sample size for a correlation to be reported. */
const MIN_SAMPLE = 3;
/** Minimum |delta| (composite points, 0-100 scale) for a correlation. */
const MIN_DELTA = 8.0;
/** |delta| at which confidence magnitude saturates to 1.0. */
const SATURATE_DELTA = 25.0;
/** Sample count at which confidence support saturates. */
const SATURATE_SAMPLE = 20;

// ---------------------------------------------------------------------------
// Stats helpers.
// ---------------------------------------------------------------------------

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let s = 0;
  for (const x of xs) s += x;
  return s / xs.length;
}

/** Format a signed delta with explicit sign, 1 decimal. */
function signedDelta(d: number): string {
  return (d >= 0 ? '+' : '') + d.toFixed(1);
}

/**
 * Confidence: we want both a meaningful effect AND enough samples.
 * magnitude = |delta| / SATURATE_DELTA (caps at 1.0 for big effects).
 * support   = min(sampleSize, SATURATE_SAMPLE) / SATURATE_SAMPLE.
 * Blend: effect dominates (0.75) but support still matters (0.25), so a
 * 50-sample small delta can outrank a 3-sample large one when effects are
 * close. Clamped to [0,1].
 */
function confidenceFor(delta: number, sampleSize: number): number {
  const magnitude = Math.min(Math.abs(delta) / SATURATE_DELTA, 1);
  const support = Math.min(sampleSize, SATURATE_SAMPLE) / SATURATE_SAMPLE;
  return Math.max(0, Math.min(1, magnitude * 0.75 + support * 0.25));
}

/** Extract the composite from a signal, or undefined if absent/invalid. */
function compositeOf(s: FeedbackSignal): number | undefined {
  const c = s?.metrics?.composite;
  return isNum(c) ? c : undefined;
}

/**
 * Compute, for a given partitioning of signals into named groups by the
 * value of `context[field]`, one Correlation per group whose in-group mean
 * diverges from the rest by >= MIN_DELTA with >= MIN_SAMPLE in-group samples.
 */
function correlationsForField(
  signals: FeedbackSignal[],
  field: 'palette' | 'concept' | 'model',
  factorPrefix: string,
  recommend: (key: string, delta: number) => string
): Correlation[] {
  // Partition by context[field]; only signals carrying a composite count.
  const groups = new Map<string, number[]>();
  for (const s of signals) {
    const composite = compositeOf(s);
    if (composite === undefined) continue;
    const raw = s.context?.[field];
    if (raw === undefined || raw === null) continue;
    const key = String(raw).trim();
    if (!key) continue;
    const arr = groups.get(key);
    if (arr) arr.push(composite);
    else groups.set(key, [composite]);
  }

  const out: Correlation[] = [];
  for (const [key, inScores] of groups) {
    if (inScores.length < MIN_SAMPLE) continue;
    // Out-group = every composite NOT in this group.
    const outScores: number[] = [];
    for (const s of signals) {
      const composite = compositeOf(s);
      if (composite === undefined) continue;
      const raw = s.context?.[field];
      if (raw === undefined || raw === null) continue;
      if (String(raw).trim() !== key) outScores.push(composite);
    }
    if (outScores.length < MIN_SAMPLE) continue;

    const inMean = mean(inScores);
    const outMean = mean(outScores);
    const delta = inMean - outMean;
    if (Math.abs(delta) < MIN_DELTA) continue;

    const direction = delta >= 0 ? 'higher' : 'lower';
    out.push({
      factor: `${factorPrefix}:${key}`,
      effect: `${signedDelta(delta)} composite (${inMean.toFixed(
        1
      )} vs ${outMean.toFixed(1)} baseline) — ${direction}`,
      confidence: confidenceFor(delta, inScores.length),
      sampleSize: inScores.length,
      recommendation: recommend(key, delta),
    });
  }
  return out;
}

/**
 * Audit-finding correlation: a banded comparison (low-finding designs vs.
 * high-finding designs) rather than per-value, because auditFindings is a
 * count. Spec: "<3 findings vs >5 findings". Finding count lives on
 * `metrics.auditFindings` in the collector schema.
 */
function auditCorrelations(signals: FeedbackSignal[]): Correlation[] {
  const low: number[] = [];
  const high: number[] = [];
  for (const s of signals) {
    const composite = compositeOf(s);
    if (composite === undefined) continue;
    const n = s.metrics?.auditFindings;
    if (!isNum(n)) continue;
    if (n < 3) low.push(composite);
    else if (n > 5) high.push(composite);
  }

  const out: Correlation[] = [];
  if (low.length >= MIN_SAMPLE && high.length >= MIN_SAMPLE) {
    const lowMean = mean(low);
    const highMean = mean(high);
    const delta = lowMean - highMean; // expect positive: fewer findings → higher score
    if (Math.abs(delta) >= MIN_DELTA) {
      out.push({
        factor: 'auditFindings:<3',
        effect: `${signedDelta(delta)} composite vs >5-finding designs (${lowMean.toFixed(
          1
        )} vs ${highMean.toFixed(1)})`,
        confidence: confidenceFor(delta, Math.min(low.length, high.length)),
        sampleSize: low.length,
        recommendation:
          delta >= 0
            ? `Designs shipping with <3 audit findings score ${signedDelta(
                delta
              )} higher — push the audit loop harder before ship.`
            : `Surprisingly, >5-finding designs score ${signedDelta(
                -delta
              )} higher — audits may be over-flagging expressive designs.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API.
// ---------------------------------------------------------------------------

/**
 * Mine all feedback signals for significant correlations.
 *
 * Examines four factors: palette, concept, model, audit-finding band. Each
 * returns every group-mean delta that clears MIN_SAMPLE (>=3) and MIN_DELTA
 * (>=8.0 composite points). Results are sorted by confidence (effect size
 * weighted by sample support), descending.
 *
 * Never throws; returns [] on any failure.
 */
export async function findCorrelations(): Promise<Correlation[]> {
  const signals = await readAll();
  if (signals.length < MIN_SAMPLE * 2) return [];

  try {
    const palette = correlationsForField(
      signals,
      'palette',
      'palette',
      (key, delta) =>
        delta >= 0
          ? `Prefer palette "${key}" for this domain — it tracks ${signedDelta(
              delta
            )} higher composite.`
          : `Avoid palette "${key}" here — it tracks ${signedDelta(
              -delta
            )} lower than alternatives.`
    );

    const concept = correlationsForField(
      signals,
      'concept',
      'concept',
      (key, delta) =>
        delta >= 0
          ? `Keep the "${key}" concept in rotation — ${signedDelta(
              delta
            )} composite uplift.`
          : `Retire or revise the "${key}" concept — ${signedDelta(
              -delta
            )} composite drag.`
    );

    const model = correlationsForField(
      signals,
      'model',
      'model',
      (key, delta) =>
        delta >= 0
          ? `Route this domain to model "${key}" — ${signedDelta(
              delta
            )} composite uplift.`
          : `Demote model "${key}" for this domain — ${signedDelta(
              -delta
            )} composite drag.`
    );

    const audit = auditCorrelations(signals);

    const all = [...palette, ...concept, ...model, ...audit];

    // Sort by confidence descending; break ties by sample size, then |delta|.
    all.sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.sampleSize !== a.sampleSize) return b.sampleSize - a.sampleSize;
      return 0;
    });

    return all;
  } catch (e) {
    console.warn(
      '[correlation-engine] findCorrelations failed:',
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

/**
 * Human-readable insight strings, derived from the top correlations.
 * German voice to match the rest of the agent's critic surface
 * ("…scoren +8.4 vs …"). Returns up to `limit` (default 10) strings.
 *
 * Never throws.
 */
export async function getTopInsights(limit: number = 10): Promise<string[]> {
  try {
    const correlations = await findCorrelations();
    const cap = Math.max(1, Math.min(limit, 50));
    const out: string[] = [];
    for (const c of correlations) {
      if (out.length >= cap) break;
      out.push(insightLine(c));
    }
    return out;
  } catch (e) {
    console.warn(
      '[correlation-engine] getTopInsights failed:',
      e instanceof Error ? e.message : e
    );
    return [];
  }
}

/** Render one correlation as a punchy, human-readable insight line. */
function insightLine(c: Correlation): string {
  const [kind, value] = c.factor.split(':');
  const label =
    kind === 'palette'
      ? `${value}-Designs`
      : kind === 'concept'
        ? `„${value}"-Konzepte`
        : kind === 'model'
          ? `Modell ${value}`
          : kind === 'auditFindings'
            ? 'Audit-arme Designs (<3 Befunde)'
            : c.factor;

  const deltaMatch = c.effect.match(/([+-]?\d+\.\d)/);
  const delta = deltaMatch ? deltaMatch[1] : '';
  const sign = delta.startsWith('-') ? '' : '+'; // explicit + for positive

  // e.g. "Cormorant-Designs scoren +12.0 composite vs. andere (n=5, conf=72%)."
  return `${label} scoren ${sign}${delta} composite vs. andere (n=${c.sampleSize}, conf=${(
    c.confidence * 100
  ).toFixed(0)}%).`;
}
