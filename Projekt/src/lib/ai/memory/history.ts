// Z.Design — Design History memory (M2).
//
// A lightweight searchable log of completed agent runs: prompt, concept name,
// domain, composite score, accent palette, optional feedback. Feeds the design
// recall / search surface so the agent (and the UI) can look back at what has
// already worked for a given domain or prompt.
//
// All functions are NON-FATAL: they catch internally and never throw, so a
// memory-layer failure can never break the design route.

import { db } from '@/lib/db';
import { reinforceDomainPositives } from '@/lib/ai/memory/negative-memory';
import { redactSecrets } from '@/lib/ai/memory/secret-redactor';

/** A raw DesignHistory row (matches the Prisma model field-for-field). */
export interface DesignHistoryRow {
  id: string;
  prompt: string;
  conceptName: string | null;
  domain: string;
  composite: number | null;
  palette: string | null;
  feedback: string | null;
  projectId: string | null;
  valence: number | null;
  outcome: string | null;
  rootCause: string | null;
  sourceAgentId: string | null;
  createdAt: Date;
}

export interface RecordDesignInput {
  prompt: string;
  conceptName?: string | null;
  domain: string;
  composite?: number | null;
  palette?: string | null;
  feedback?: string | null;
  projectId?: string | null;
  /** Affect in [-1, +1]. If omitted, derived from composite (see deriveValence). */
  valence?: number | null;
  /** 'success' | 'neutral' | 'failure'. If omitted, derived from composite. */
  outcome?: string | null;
  /** Why it failed / what to avoid (free text, surfaces in negative recall). */
  rootCause?: string | null;
  /** Which agent/skill wrote the episode (trust-tiering + attribution). */
  sourceAgentId?: string | null;
}

/**
 * Derive a valence [-1, +1] and an outcome label from a 0-10 composite.
 *   composite >= 8 → success (+1)   |   >= 7 → neutral (0)   |   < 7 → failure (-1)
 * The valence is continuous so recall can weight magnitude, while outcome is
 * the categorical bucket used for filtering. This is the "affect" the negative
 * memory layer reads — every recorded design becomes a +/- memory automatically,
 * with no change to callers.
 */
export function deriveValence(
  composite?: number | null,
): { valence: number; outcome: 'success' | 'neutral' | 'failure' } {
  if (composite == null || !Number.isFinite(composite)) {
    return { valence: 0, outcome: 'neutral' };
  }
  const valence = Math.max(-1, Math.min(1, (composite - 7) / 3));
  const outcome: 'success' | 'neutral' | 'failure' =
    composite >= 8 ? 'success' : composite >= 7 ? 'neutral' : 'failure';
  return { valence, outcome };
}

/**
 * Persist one design run as a DesignHistory row. Never throws.
 */
export async function recordDesign(entry: RecordDesignInput): Promise<void> {
  try {
    const derived = deriveValence(entry.composite);
    const valence = entry.valence ?? derived.valence;
    // P2.5 SECRET GUARD: scrub any secret-shaped span from user-derived fields
    //   BEFORE persisting, so the learned memory never stores a leaked key.
    const cleanStr = (v?: string | null) => redactSecrets(v ?? '').clean;
    await db.designHistory.create({
      data: {
        prompt: cleanStr(entry.prompt),
        conceptName: entry.conceptName ?? null,
        domain: entry.domain,
        composite: entry.composite ?? null,
        palette: entry.palette ?? null,
        feedback: cleanStr(entry.feedback),
        projectId: entry.projectId ?? null,
        valence,
        outcome: entry.outcome ?? derived.outcome,
        rootCause: cleanStr(entry.rootCause),
        sourceAgentId: entry.sourceAgentId ?? null,
      },
    });
    // P2.1 extinction loop: a success in this domain weakens its prior negatives
    // (counter-evidence). Fire-and-forget — never blocks/breaks the design write.
    if (valence > 0) void reinforceDomainPositives(entry.domain);
  } catch (e) {
    console.warn('[memory/history] recordDesign failed:', e instanceof Error ? e.message : e);
  }
}

/**
 * Case-insensitive LIKE search across prompt, conceptName, domain, feedback.
 * Returns the newest matches first. Never throws.
 */
export async function searchHistory(query: string, limit: number = 20): Promise<DesignHistoryRow[]> {
  try {
    if (!query || !query.trim()) return [];
    const term = `%${query.trim()}%`;
    return await db.designHistory.findMany({
      where: {
        OR: [
          { prompt: { contains: term } },
          { conceptName: { contains: term } },
          { domain: { contains: term } },
          { feedback: { contains: term } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  } catch (e) {
    console.warn('[memory/history] searchHistory failed:', e instanceof Error ? e.message : e);
    return [];
  }
}

/**
 * Newest N design runs. Never throws.
 */
export async function getRecentDesigns(limit: number = 20): Promise<DesignHistoryRow[]> {
  try {
    return await db.designHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(limit, 200)),
    });
  } catch (e) {
    console.warn('[memory/history] getRecentDesigns failed:', e instanceof Error ? e.message : e);
    return [];
  }
}
