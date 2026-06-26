/**
 * skill-memory.ts — Self-improving SKILL MEMORY store (Hermes-inspired).
 * Learns winning art-direction recipes per topic, reloads the best approved
 * recipe as a baseline, and gates writes behind an approval threshold.
 * Sole owner of all DesignLesson reads/writes. No model calls at import time.
 */
import { db } from '@/lib/db'
import { jsonrepair } from 'jsonrepair'
import { appendLessonHistory } from '@/lib/ai/memory/negative-memory'

export interface DesignRecipe {
  topic: string
  palette: Record<string, string>
  fonts: { display: string; body: string }
  layoutArchetype: string
  soulGestures: string[]
  praisedByPanelists: string[]
  avoidPatterns: string[]
  sourceComposite: number
}

/** Propose a recipe when the theater composite reaches at least this.
 *  Calibrated to the Theater's real landing band (~7.4–7.9 for solid designs)
 *  so the learning loop fires reliably — 7.5 sat right at the edge and missed. */
export const LEARN_THRESHOLD = 7.0
/** Auto-approve a proposed recipe when its composite reaches at least this.
 *  Below this, the recipe is stored as PENDING for user review (trust gate). */
export const AUTO_APPROVE_THRESHOLD = 8.5

/** Best approved recipe for a topic (highest composite), or null. Never throws. */
export async function loadApprovedRecipeForTopic(
  topic: string,
): Promise<DesignRecipe | null> {
  try {
    if (!topic) return null
    const row = await db.designLesson.findFirst({
      where: { topic, approved: true },
      orderBy: { composite: 'desc' },
      take: 1,
    })
    if (!row) return null
    return parseRecipe(row.recipeJson, row.composite)
  } catch {
    return null
  }
}

/** Distill WHY a winning design scored high into a reusable recipe. Null on failure. */
export async function proposeRecipe(
  topic: string,
  html: string,
  briefSummary: string,
  theaterSummary: string,
  call: (prompt: string, opts?: { maxTokens?: number; temperature?: number }) => Promise<string>,
): Promise<DesignRecipe | null> {
  try {
    if (!topic || !html) return null
    const prompt = [
      `You are a senior art-director distilling a WINNING design into a reusable recipe.`,
      `Topic: "${topic}"`,
      `--- BRIEF ---`, (briefSummary?.trim() || '(no brief provided)'),
      `--- CRITIC THEATER (per-panelist scores + refinements) ---`, (theaterSummary?.trim() || '(no theater summary)'),
      `--- WINNING HTML ---`, html.slice(0, 40_000),
      `Extract a reusable DESIGN RECIPE for topic "${topic}" that captures WHY this scored high.`,
      `Return ONLY JSON, no prose, no fences, exactly this shape:`,
      `{ "palette": {"bg","surface","accent","text","textMuted","border"}, "fonts": {"display","body"},`,
      `  "layoutArchetype": "one short label", "soulGestures": ["3-5 distinctive moves"],`,
      `  "praisedByPanelists": ["what panelists scored 9+"], "avoidPatterns": ["2-3 to avoid"],`,
      `  "sourceComposite": <number 0-10> }`,
    ].join('\n')

    const raw = await call(prompt, { maxTokens: 2048, temperature: 0.2 })
    if (!raw) return null
    const recipe = parseRecipe(raw)
    if (!recipe) return null
    recipe.topic = topic
    recipe.sourceComposite = clamp(recipe.sourceComposite)
    return recipe
  } catch {
    return null
  }
}

/** Persist a proposal; auto-approves when sourceComposite >= AUTO_APPROVE_THRESHOLD. */
export async function saveRecipeProposal(
  recipe: DesignRecipe,
  source = 'auto',
): Promise<{ id: string; approved: boolean }> {
  const composite = clamp(recipe.sourceComposite)
  const approved = composite >= AUTO_APPROVE_THRESHOLD
  const created = await db.designLesson.create({
    data: {
      topic: recipe.topic,
      recipeJson: JSON.stringify({ ...recipe, sourceComposite: composite }),
      composite,
      source,
      approved,
    },
  })
  await appendLessonHistory({
    lessonId: created.id,
    topic: recipe.topic,
    changeType: 'create',
    afterJson: JSON.stringify({ ...recipe, sourceComposite: composite }),
    composite,
    sourceAgentId: source,
  })
  return { id: created.id, approved }
}

/**
 * PATCH-OVER-REWRITE (Hermes): merge a new winning recipe into the best
 * existing APPROVED lesson for the topic, instead of storing a duplicate.
 *
 * - No approved lesson for the topic → behave like saveRecipeProposal (create new), {patched:false}.
 * - Exists → MERGE: union/dedupe soulGestures, praisedByPanelists, avoidPatterns
 *   (append only items not already present, preserving order and the originals first);
 *   keep the higher-composite palette + fonts; bump version; recompute approved
 *   (stay approved if the merged composite stays >= AUTO_APPROVE, otherwise keep prior state).
 * Returns {patched:true} with the updated row's id + approved flag.
 */
export async function patchRecipe(
  topic: string,
  newRecipe: DesignRecipe,
): Promise<{ id: string; approved: boolean; patched: boolean }> {
  const newComposite = clamp(newRecipe.sourceComposite)

  try {
    if (!topic) {
      // No topic to match on — fall back to a fresh proposal.
      const created = await saveRecipeProposal({ ...newRecipe, topic, sourceComposite: newComposite })
      return { id: created.id, approved: created.approved, patched: false }
    }

    const existing = await db.designLesson.findFirst({
      where: { topic, approved: true },
      orderBy: { composite: 'desc' },
      take: 1,
    })

    if (!existing) {
      // Nothing to patch — store as a new proposal (auto-approve path applies).
      const created = await saveRecipeProposal({ ...newRecipe, topic, sourceComposite: newComposite })
      return { id: created.id, approved: created.approved, patched: false }
    }

    const base = parseRecipe(existing.recipeJson, existing.composite)
    if (!base) {
      // Stored recipeJson was unparseable — don't corrupt it; create a fresh proposal instead.
      const created = await saveRecipeProposal({ ...newRecipe, topic, sourceComposite: newComposite })
      return { id: created.id, approved: created.approved, patched: false }
    }

    // --- MERGE ---
    const mergedSoulGestures = dedupe(base.soulGestures, newRecipe.soulGestures)
    const mergedPraised = dedupe(base.praisedByPanelists, newRecipe.praisedByPanelists)
    const mergedAvoid = dedupe(base.avoidPatterns, newRecipe.avoidPatterns)

    // Keep whichever side scored higher for palette + fonts (winner-take-all).
    const winnerIsNew = newComposite >= (base.sourceComposite ?? 0)
    const palette = winnerIsNew ? newRecipe.palette : base.palette
    const fonts = winnerIsNew ? newRecipe.fonts : base.fonts
    const layoutArchetype = winnerIsNew
      ? (newRecipe.layoutArchetype || base.layoutArchetype)
      : (base.layoutArchetype || newRecipe.layoutArchetype)

    // Merged composite = the higher of the two (so the lesson's headline score
    // reflects the best-known signal, not an average that would erode it).
    const mergedComposite = Math.max(newComposite, clamp(base.sourceComposite ?? 0))

    // Approved state: if the merged (winning) composite clears auto-approve,
    // stay approved; otherwise preserve whatever the existing row had.
    const approved = mergedComposite >= AUTO_APPROVE_THRESHOLD ? true : existing.approved

    const mergedRecipe: DesignRecipe = {
      topic,
      palette,
      fonts,
      layoutArchetype,
      soulGestures: mergedSoulGestures,
      praisedByPanelists: mergedPraised,
      avoidPatterns: mergedAvoid,
      sourceComposite: mergedComposite,
    }

    const updated = await db.designLesson.update({
      where: { id: existing.id },
      data: {
        recipeJson: JSON.stringify(mergedRecipe),
        composite: mergedComposite,
        approved,
        version: { increment: 1 },
        // updatedAt is @updatedAt so it auto-bumps; no need to set it.
      },
    })
    await appendLessonHistory({
      lessonId: existing.id,
      topic,
      changeType: 'patch',
      beforeJson: existing.recipeJson,
      afterJson: JSON.stringify(mergedRecipe),
      reason: 'merged new winning recipe into approved baseline',
      composite: mergedComposite,
    })

    return { id: updated.id, approved: updated.approved, patched: true }
  } catch {
    // Never throw out of the learning loop — on any failure, degrade to a
    // plain proposal write so the new recipe still lands somewhere.
    const created = await saveRecipeProposal({ ...newRecipe, topic, sourceComposite: newComposite })
    return { id: created.id, approved: created.approved, patched: false }
  }
}

export async function listLessons(
  opts?: { approvedOnly?: boolean },
): Promise<Array<{ id: string; topic: string; composite: number; approved: boolean; source: string; recipeJson: string }>> {
  return db.designLesson.findMany({
    where: opts?.approvedOnly ? { approved: true } : undefined,
    orderBy: { createdAt: 'desc' },
    select: { id: true, topic: true, composite: true, approved: true, source: true, recipeJson: true },
  })
}

export async function approveLesson(id: string): Promise<void> {
  await db.designLesson.update({ where: { id }, data: { approved: true } })
}

/** Reject a lesson — removed entirely from the store. */
export async function rejectLesson(id: string): Promise<void> {
  await db.designLesson.delete({ where: { id } })
}

// --- helpers ---

function parseRecipe(raw: string, fallbackComposite?: number): DesignRecipe | null {
  try {
    const obj = JSON.parse(jsonrepair(raw)) as Partial<DesignRecipe>
    if (!obj || typeof obj !== 'object') return null
    const composite =
      clamp(obj.sourceComposite) ??
      (typeof fallbackComposite === 'number' ? clamp(fallbackComposite) : 0)
    return {
      topic: String(obj.topic ?? ''),
      palette:
        obj.palette && typeof obj.palette === 'object'
          ? (obj.palette as Record<string, string>)
          : {},
      fonts:
        obj.fonts && typeof obj.fonts === 'object'
          ? { display: String(obj.fonts.display ?? ''), body: String(obj.fonts.body ?? '') }
          : { display: '', body: '' },
      layoutArchetype: String(obj.layoutArchetype ?? ''),
      soulGestures: asStringArray(obj.soulGestures),
      praisedByPanelists: asStringArray(obj.praisedByPanelists),
      avoidPatterns: asStringArray(obj.avoidPatterns),
      sourceComposite: composite,
    }
  } catch {
    return null
  }
}

function asStringArray(val: unknown): string[] {
  return Array.isArray(val) ? val.map((v) => String(v)).filter((s) => s.length > 0) : []
}

/** Union of two string arrays, preserving order: base items first, then new
 *  items not already present. Case-insensitive dedupe so near-duplicates
 *  ("Warm earth tones" vs "warm earth tones") don't pile up. */
function dedupe(base: string[], additions: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of [...base, ...additions]) {
    const s = String(item ?? '').trim()
    if (!s) continue
    const key = s.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/** Coerce to a finite 0-10 number; hallucinated values can't auto-approve. */
function clamp(val: unknown): number {
  const n = typeof val === 'string' ? parseFloat(val) : (val as number)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, n))
}
