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
}

/**
 * Persist one design run as a DesignHistory row. Never throws.
 */
export async function recordDesign(entry: RecordDesignInput): Promise<void> {
  try {
    await db.designHistory.create({
      data: {
        prompt: entry.prompt,
        conceptName: entry.conceptName ?? null,
        domain: entry.domain,
        composite: entry.composite ?? null,
        palette: entry.palette ?? null,
        feedback: entry.feedback ?? null,
        projectId: entry.projectId ?? null,
      },
    });
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
