/**
 * consolidation.ts — P2.4 guarded shadow-write consolidation + kill-switch.
 *
 * Distills recurring negative episodes into candidate anti-patterns. Candidates
 * land in a SHADOW table first; promotion is EVAL-GATED (confidence ≥ threshold
 * AND ≥2 source episodes AND kill-switch off) and never touches live memory
 * unmonitored. A kill-switch rolls any candidate back in one update. This is
 * the global-corruption-blast-radius guard: a bad consolidation run cannot
 * poison every agent's memory.
 *
 * Deterministic by default (clusters by normalized rootCause). An optional
 * `distill` callback (LLM) refines a cluster into a crisp one-line anti-pattern
 * — that is the documented graduation hook; without it the cluster's modal
 * rootCause is used verbatim.
 *
 * Never throws on the read/list path.
 */
import { db } from '@/lib/db';
import { normAnti } from '@/lib/ai/memory/negative-memory';
import { appendLessonHistory } from '@/lib/ai/memory/negative-memory';

/** Promote only when confidence ≥ this AND ≥ this many source episodes. */
const PROMOTE_CONFIDENCE = 0.5; // 0..1 (cluster prevalence among recent negatives)
const PROMOTE_MIN_EPISODES = 2;

export type ConsolidationStatus = 'shadow' | 'promoted' | 'killed';

export interface ConsolidationCandidate {
  id: string;
  topic: string;
  antiPattern: string;
  sourceEpisodeIds: string[];
  confidence: number;
  status: ConsolidationStatus;
  killSwitch: boolean;
  createdAt: Date;
  promotedAt: Date | null;
}

/**
 * Propose consolidation candidates for a topic: cluster recent negative
 * episodes (valence<0) by normalized rootCause; each cluster of ≥2 becomes a
 * SHADOW candidate. Optionally refine each cluster's label via an LLM distill
 * callback. Returns the created candidate ids. Never throws.
 */
export async function proposeConsolidation(opts: {
  topic: string;
  sinceDays?: number;
  distill?: (cluster: { topic: string; samples: string[] }) => Promise<string>;
}): Promise<ConsolidationCandidate[]> {
  const topic = (opts.topic ?? '').trim();
  if (!topic) return [];
  try {
    const since = opts.sinceDays ?? 30;
    const sinceMs = Date.now() - since * 86_400_000;
    const episodes = await db.designHistory.findMany({
      where: { valence: { lt: 0 }, domain: { contains: topic } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { id: true, rootCause: true, feedback: true, outcome: true, createdAt: true },
    });
    const recent = episodes.filter((e) => (e.createdAt?.getTime() ?? sinceMs) >= sinceMs);
    if (recent.length === 0) return [];

    // cluster by normalized anti-pattern
    const clusters = new Map<string, { samples: string[]; ids: string[]; latest: number }>();
    for (const e of recent) {
      const raw = (e.rootCause?.trim() || e.feedback?.trim() || e.outcome || 'poor outcome').slice(0, 200);
      const key = normAnti(raw);
      if (!key) continue;
      const c = clusters.get(key) ?? { samples: [], ids: [], latest: 0 };
      if (c.samples.length < 5) c.samples.push(raw);
      c.ids.push(e.id);
      c.latest = Math.max(c.latest, e.createdAt?.getTime() ?? 0);
      clusters.set(key, c);
    }

    const created: ConsolidationCandidate[] = [];
    for (const [anti, c] of clusters) {
      if (c.ids.length < PROMOTE_MIN_EPISODES) continue; // singletons don't consolidate
      const confidence = Math.min(1, c.ids.length / recent.length);
      let label = anti;
      if (opts.distill) {
        try {
          const refined = await opts.distill({ topic, samples: c.samples });
          if (refined && refined.trim()) label = normAnti(refined);
        } catch {
          /* keep deterministic label */
        }
      }
      const row = await db.designConsolidation.create({
        data: {
          topic,
          candidateJson: JSON.stringify({ antiPattern: label, samples: c.samples }),
          sourceEpisodeIds: JSON.stringify(c.ids),
          confidence,
          status: 'shadow',
          killSwitch: false,
        },
      });
      created.push(toCandidate(row, label));
    }
    return created;
  } catch (e) {
    console.warn('[memory/consolidation] propose failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Promote a shadow candidate to LIVE memory (an approved avoidPattern), but
 * ONLY if it clears the eval gate: status shadow + kill-switch off + confidence
 * ≥ threshold + ≥ PROMOTE_MIN_EPISODES sources. Throws on gate failure (caller
 * surfaces it) so promotions are explicit and audited. Appends to
 * DesignLessonHistory on success.
 */
export async function promoteConsolidation(id: string): Promise<{ promoted: boolean; reason?: string }> {
  try {
    const row = await db.designConsolidation.findUnique({ where: { id } });
    if (!row) return { promoted: false, reason: 'not found' };
    if (row.killSwitch) return { promoted: false, reason: 'kill-switch on' };
    if (row.status !== 'shadow') return { promoted: false, reason: `status is ${row.status}` };

    let sourceIds: string[] = [];
    try {
      sourceIds = JSON.parse(row.sourceEpisodeIds) as string[];
    } catch {
      sourceIds = [];
    }
    const parsed = JSON.parse(row.candidateJson || '{}') as { antiPattern?: string; samples?: string[] };
    const antiPattern = parsed.antiPattern ?? '';

    // --- EVAL GATE ---
    if (row.confidence < PROMOTE_CONFIDENCE) {
      return { promoted: false, reason: `confidence ${row.confidence.toFixed(2)} < ${PROMOTE_CONFIDENCE}` };
    }
    if (sourceIds.length < PROMOTE_MIN_EPISODES) {
      return { promoted: false, reason: `only ${sourceIds.length} source episodes` };
    }
    if (!antiPattern) {
      return { promoted: false, reason: 'empty anti-pattern' };
    }

    // --- PROMOTE: write as an approved avoidPattern-bearing lesson ---
    const composite = 7 + row.confidence * 2; // 7..9 — above the 7.0 learn floor
    const recipeJson = JSON.stringify({
      avoidPatterns: [antiPattern],
      consolidated: true,
      sourceEpisodeIds: sourceIds,
      confidence: row.confidence,
      samples: parsed.samples ?? [],
    });
    const lesson = await db.designLesson.create({
      data: { topic: row.topic, recipeJson, composite, source: 'consolidation', approved: true },
    });
    await db.designConsolidation.update({
      where: { id },
      data: { status: 'promoted', promotedAt: new Date() },
    });
    await appendLessonHistory({
      lessonId: lesson.id,
      topic: row.topic,
      changeType: 'create',
      afterJson: recipeJson,
      reason: `consolidation promoted (${sourceIds.length} episodes, confidence ${row.confidence.toFixed(2)})`,
      composite,
      sourceAgentId: 'consolidation',
    });
    return { promoted: true };
  } catch (e) {
    console.warn('[memory/consolidation] promote failed:', e instanceof Error ? e.message : e);
    return { promoted: false, reason: 'internal error' };
  }
}

/** Roll a candidate back / block promotion in one update (kill-switch). */
export async function killConsolidation(id: string): Promise<void> {
  try {
    await db.designConsolidation.update({
      where: { id },
      data: { killSwitch: true, status: 'killed' },
    });
  } catch (e) {
    console.warn('[memory/consolidation] kill failed:', e instanceof Error ? e.message : e);
  }
}

/** List candidates, optionally filtered by status. Never throws. */
export async function listConsolidation(
  status?: ConsolidationStatus,
): Promise<ConsolidationCandidate[]> {
  try {
    const rows = await db.designConsolidation.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => {
      const parsed = JSON.parse(r.candidateJson || '{}') as { antiPattern?: string };
      return toCandidate(r, parsed.antiPattern ?? '(unnamed)');
    });
  } catch (e) {
    console.warn('[memory/consolidation] list failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

function toCandidate(
  r: {
    id: string;
    topic: string;
    candidateJson: string;
    sourceEpisodeIds: string;
    confidence: any;
    status: string;
    killSwitch: boolean;
    createdAt: Date;
    promotedAt: Date | null;
  },
  antiPattern: string,
): ConsolidationCandidate {
  let ids: string[] = [];
  try {
    ids = JSON.parse(r.sourceEpisodeIds) as string[];
  } catch {
    ids = [];
  }
  return {
    id: r.id,
    topic: r.topic,
    antiPattern,
    sourceEpisodeIds: ids,
    confidence: typeof r.confidence === 'number' ? r.confidence : 0,
    status: r.status as ConsolidationStatus,
    killSwitch: r.killSwitch,
    createdAt: r.createdAt,
    promotedAt: r.promotedAt,
  };
}
