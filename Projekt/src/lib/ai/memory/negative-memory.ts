/**
 * negative-memory.ts — P1: human-like negative-memory recall on the EXISTING
 * Prisma substrate (no Neo4j). The "amygdala/hippocampus" read path: surfaces
 * AVOID signals — anti-patterns distilled into approved DesignLessons + raw
 * negative episodes from DesignHistory (valence < 0) — ranked by a realistic
 * salience function with bounded loss-aversion (~2×, NOT 10×, per the synthesis
 * — human loss-aversion is a bias, not an optimum; over-weighting causes
 * avoidance paralysis).
 *
 * Salience = |valence| × recencyDecay × (1 + log(1+frequency)) × lossAversion
 *   recencyDecay = exp(-ageDays / HALF_LIFE_DAYS)
 *   lossAversion = 2.0 when valence < 0 else 1.0
 *
 * Companion: appendLessonHistory() — append-only skill audit (invalidate-not-
 * delete in pure Prisma), so every DesignLesson rewrite is recoverable.
 *
 * Never throws — the memory layer must never break a design response.
 */
import { db } from '@/lib/db';
import { estimateTokens } from '@/lib/ai/memory/context-manager';

/** ~30-day half-life for recency decay. Tunable. */
const HALF_LIFE_DAYS = 30;
/** Bounded loss-aversion: negative memories weigh 2×, not 10×. */
const LOSS_AVERSION = 2.0;
/** Default token budget for a recall payload (keeps the agent's context lean). */
const DEFAULT_RECALL_BUDGET_TOKENS = 1200;

export interface RecallItem {
  source: 'episode' | 'recipe';
  /** One-line, agent-usable "avoid …" string. */
  text: string;
  valence: number;
  salience: number;
  frequency: number;
  provenance: {
    kind: 'DesignHistory' | 'DesignLesson';
    id?: string;
    topic?: string;
    composite?: number;
    createdAt?: Date;
  };
}

export interface RecallResult {
  domain: string;
  items: RecallItem[];
  budget: { used: number; max: number };
  note?: string;
}

/**
 * Recall ranked AVOID signals for a domain (and optional context). Combines
 * (a) anti-patterns from approved DesignLessons and (b) negative DesignHistory
 * episodes, dedupes case-insensitively, scores salience, and trims to a token
 * budget. Never throws.
 */
export async function recallAntiPatterns(opts: {
  domain: string;
  context?: string;
  maxTokens?: number;
  limit?: number;
}): Promise<RecallResult> {
  const domain = (opts.domain ?? '').trim();
  const budget = opts.maxTokens ?? DEFAULT_RECALL_BUDGET_TOKENS;
  const baseResult: RecallResult = { domain, items: [], budget: { used: 0, max: budget } };
  if (!domain) return baseResult;
  try {
    const now = Date.now();

    // --- (a) anti-patterns from approved recipes for the domain ---
    const lessons = await db.designLesson.findMany({
      where: {
        approved: true,
        topic: { contains: domain },
      },
      orderBy: { composite: 'desc' },
      take: 20,
      select: { id: true, topic: true, composite: true, recipeJson: true, createdAt: true },
    });
    const recipeCandidates: RecallItem[] = [];
    for (const l of lessons) {
      const avoid = extractAvoidPatterns(l.recipeJson);
      for (const a of avoid) {
        recipeCandidates.push({
          source: 'recipe',
          text: a,
          valence: -1,
          // a high-composite lesson's avoid-list is well-supported evidence
          salience: ((l.composite ?? 0) / 10) * LOSS_AVERSION,
          frequency: 1,
          provenance: {
            kind: 'DesignLesson',
            id: l.id,
            topic: l.topic,
            composite: l.composite ?? undefined,
            createdAt: l.createdAt ?? undefined,
          },
        });
      }
    }

    // --- (b) negative episodes from DesignHistory (valence < 0) ---
    const episodes = await db.designHistory.findMany({
      where: { valence: { lt: 0 } },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        id: true,
        prompt: true,
        domain: true,
        composite: true,
        valence: true,
        outcome: true,
        rootCause: true,
        feedback: true,
        createdAt: true,
      },
    });
    // keep episodes relevant to the domain (contains either way) OR the context
    const ctx = (opts.context ?? '').toLowerCase();
    const domainLc = domain.toLowerCase();
    const relevant = episodes.filter((e) => {
      const hay = `${e.domain} ${e.prompt} ${e.rootCause ?? ''} ${e.feedback ?? ''}`.toLowerCase();
      return hay.includes(domainLc) || (ctx ? hay.includes(ctx) : false);
    });

    // group by normalized text so frequency accumulates (repeated failures weigh more)
    const byKey = new Map<string, RecallItem & { _count: number; _latest: Date }>();
    for (const e of relevant) {
      const text = `avoid (${e.domain}): ${e.rootCause?.trim() || e.feedback?.trim() || e.outcome || 'poor outcome'}`.slice(0, 240);
      const key = text.toLowerCase();
      const ageDays = (now - (e.createdAt?.getTime() ?? now)) / 86_400_000;
      const recency = Math.exp(-ageDays / HALF_LIFE_DAYS);
      const salience =
        Math.abs(e.valence ?? 1) * recency * LOSS_AVERSION;
      const existing = byKey.get(key);
      if (existing) {
        existing._count += 1;
        existing.salience = Math.max(existing.salience, salience) * (1 + Math.log10(1 + existing._count));
        if ((e.createdAt?.getTime() ?? 0) > existing._latest.getTime()) existing._latest = e.createdAt!;
      } else {
        byKey.set(key, {
          source: 'episode',
          text,
          valence: e.valence ?? -1,
          salience,
          frequency: 1,
          provenance: {
            kind: 'DesignHistory',
            id: e.id,
            topic: e.domain,
            composite: e.composite ?? undefined,
            createdAt: e.createdAt ?? undefined,
          },
          _count: 1,
          _latest: e.createdAt ?? new Date(0),
        });
      }
    }
    const episodeCandidates = [...byKey.values()].map(({ _count, _latest, ...item }) => ({
      ...item,
      frequency: _count,
    }));

    // --- merge, dedupe (case-insensitive on text), rank, budget ---
    const merged = dedupeByText([...recipeCandidates, ...episodeCandidates]);
    merged.sort((a, b) => b.salience - a.salience);

    const limit = opts.limit ?? 25;
    const ranked = merged.slice(0, limit);

    // token-budget the payload (each item rendered as one line)
    const out: RecallItem[] = [];
    let used = 0;
    for (const item of ranked) {
      const line = `⚠ ${item.text}  [salience ${item.salience.toFixed(2)}, ×${item.frequency}]`;
      const cost = estimateTokens(line);
      if (used + cost > budget && out.length > 0) break; // never exceed budget
      used += cost;
      out.push(item);
    }
    return {
      domain,
      items: out,
      budget: { used, max: budget },
      note:
        out.length === 0
          ? 'no negative memories for this domain yet'
          : undefined,
    };
  } catch (e) {
    console.warn('[memory/negative] recallAntiPatterns failed:', e instanceof Error ? e.message : e);
    return { ...baseResult, note: 'recall failed (degraded)' };
  }
}

/** Extract avoidPatterns[] from a recipe JSON string (best-effort, non-throwing). */
function extractAvoidPatterns(recipeJson: string | null): string[] {
  if (!recipeJson) return [];
  try {
    const obj = JSON.parse(recipeJson) as { avoidPatterns?: unknown };
    if (Array.isArray(obj.avoidPatterns)) {
      return obj.avoidPatterns.map((v) => String(v).trim()).filter((s) => s.length > 0);
    }
  } catch {
    /* unparseable recipe — skip */
  }
  return [];
}

/** Case-insensitive dedupe on item.text, keeping the higher-salience copy. */
function dedupeByText(items: RecallItem[]): RecallItem[] {
  const map = new Map<string, RecallItem>();
  for (const it of items) {
    const key = it.text.toLowerCase();
    const prev = map.get(key);
    if (!prev || it.salience > prev.salience) map.set(key, { ...it, frequency: (prev?.frequency ?? 0) + it.frequency });
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Append-only skill audit (invalidate-not-delete in pure Prisma).
// ---------------------------------------------------------------------------

export interface LessonChange {
  lessonId?: string | null;
  topic: string;
  changeType: 'create' | 'patch' | 'approve' | 'reject';
  beforeJson?: string | null;
  afterJson?: string | null;
  reason?: string | null;
  sourceAgentId?: string | null;
  composite?: number | null;
}

/** Append one skill-rewrite record so prior versions are always recoverable. Never throws. */
export async function appendLessonHistory(change: LessonChange): Promise<void> {
  try {
    await db.designLessonHistory.create({
      data: {
        lessonId: change.lessonId ?? null,
        topic: change.topic,
        changeType: change.changeType,
        beforeJson: change.beforeJson ?? null,
        afterJson: change.afterJson ?? null,
        reason: change.reason ?? null,
        sourceAgentId: change.sourceAgentId ?? null,
        composite: change.composite ?? null,
      },
    });
  } catch (e) {
    console.warn('[memory/negative] appendLessonHistory failed:', e instanceof Error ? e.message : e);
  }
}
