/**
 * Sanity check for correlation-engine (I2).
 *
 * Injects 10 mock signals across 2 palettes (Cormorant strong, Inter weak)
 * via setFeedbackReader and asserts:
 *   1. findCorrelations returns a palette correlation for each.
 *   2. The Cormorant correlation points positive, Inter negative.
 *   3. getTopInsights returns at least one human-readable line mentioning
 *      the delta.
 *   4. MIN_SAMPLE is respected (a 1-sample 3rd palette is dropped).
 *   5. Graceful [] when the reader is unset.
 *
 * Uses the REAL FeedbackSignal shape from feedback-collector:
 *   { metrics: { composite: 0-100, auditFindings? }, context: { palette, ... } }
 *
 * Run: bun test tests/correlation-engine.sanity.test.ts
 */
import { expect, test, describe, beforeEach } from 'bun:test';
import {
  findCorrelations,
  getTopInsights,
  setFeedbackReader,
  type FeedbackSignal,
} from '../src/lib/ai/improvement/correlation-engine';

// 10 signals: 5 Cormorant (strong ~86), 5 Inter (weak ~65).
// Group-mean delta = ~21 composite points (>> MIN_DELTA of 8.0).
const baseSignals: FeedbackSignal[] = [
  sig('Cormorant', 86),
  sig('Cormorant', 84),
  sig('Cormorant', 88),
  sig('Cormorant', 83),
  sig('Cormorant', 85),
  sig('Inter', 64),
  sig('Inter', 66),
  sig('Inter', 63),
  sig('Inter', 67),
  sig('Inter', 65),
];

function sig(palette: string, composite: number): FeedbackSignal {
  return {
    timestamp: Date.now(),
    skillType: 'panelists',
    skillId: `${palette}-${composite}`,
    outcome: 'success',
    metrics: { composite },
    context: { palette, topic: 'asian-spa' },
  };
}

describe('correlation-engine', () => {
  beforeEach(() => {
    setFeedbackReader(async () => baseSignals);
  });

  test('finds the palette correlation (Cormorant +, Inter -)', async () => {
    const correlations = await findCorrelations();
    const palette = correlations.filter((c) => c.factor.startsWith('palette:'));
    expect(palette.length).toBe(2);

    const cormorant = palette.find((c) => c.factor === 'palette:Cormorant');
    const inter = palette.find((c) => c.factor === 'palette:Inter');
    expect(cormorant).toBeDefined();
    expect(inter).toBeDefined();

    expect(cormorant!.sampleSize).toBe(5);
    expect(cormorant!.effect).toContain('+');
    expect(inter!.effect).toContain('-');

    // +delta and -delta of equal magnitude yield equal confidence by design
    // (confidence measures effect strength, not direction).
    expect(cormorant!.confidence).toBeCloseTo(inter!.confidence, 5);
    // Cormorant appears at or before Inter in the sorted output (stable order).
    const cIdx = correlations.findIndex((c) => c.factor === 'palette:Cormorant');
    const iIdx = correlations.findIndex((c) => c.factor === 'palette:Inter');
    expect(cIdx).toBeLessThanOrEqual(iIdx);
  });

  test('respects MIN_SAMPLE — a tiny 3rd palette is dropped', async () => {
    const withTiny: FeedbackSignal[] = [
      ...baseSignals,
      sig('Rare', 95), // only 1 sample — below MIN_SAMPLE (3)
    ];
    setFeedbackReader(async () => withTiny);
    const correlations = await findCorrelations();
    expect(correlations.find((c) => c.factor === 'palette:Rare')).toBeUndefined();
  });

  test('audit-finding band correlation (low <3 vs high >5)', async () => {
    // 4 low-finding high-score + 4 high-finding low-score signals.
    const auditSignals: FeedbackSignal[] = [
      auditSig(88, 1),
      auditSig(90, 2),
      auditSig(87, 1),
      auditSig(89, 0),
      auditSig(60, 7),
      auditSig(58, 8),
      auditSig(62, 6),
      auditSig(59, 9),
    ];
    setFeedbackReader(async () => auditSignals);
    const correlations = await findCorrelations();
    const audit = correlations.find((c) => c.factor === 'auditFindings:<3');
    expect(audit).toBeDefined();
    expect(audit!.sampleSize).toBeGreaterThanOrEqual(3);
    expect(audit!.effect).toContain('+'); // low-finding → higher score
  });

  test('getTopInsights yields readable German lines with deltas', async () => {
    setFeedbackReader(async () => baseSignals);
    const insights = await getTopInsights(5);
    expect(insights.length).toBeGreaterThanOrEqual(1);
    const top = insights[0];
    expect(top).toContain('Cormorant');
    expect(top).toMatch(/\+\d+\.\d/);
    expect(top).toContain('n=');
  });

  test('returns [] gracefully when reader is unset / null', async () => {
    setFeedbackReader(null);
    expect(await findCorrelations()).toEqual([]);
    expect(await getTopInsights()).toEqual([]);
  });
});

function auditSig(composite: number, findings: number): FeedbackSignal {
  return {
    timestamp: Date.now(),
    skillType: 'panelists',
    skillId: `audit-${composite}-${findings}`,
    outcome: 'success',
    metrics: { composite, auditFindings: findings },
    context: { palette: 'emerald', topic: 'x' },
  };
}
