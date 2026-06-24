/**
 * progressive-disclosure.ts — 3-level context loader for skills/recipes
 * (Hermes-inspired). Keeps the system-prompt FLAT regardless of how many
 * skills/recipes exist: only Level-0 one-liners ride in the index, and the
 * full body (Level 1) is loaded on demand when a trigger keyword matches.
 *
 *   Level 0 — name + one-line description (~50 tokens). Always in context.
 *             Example: "asian-spa: gold/ivory spa aesthetic (Ø8.1)"
 *   Level 1 — full body (the actual skill text / recipe JSON). Loaded on demand.
 *   Level 2 — optional reference / debug / patch history. Loaded only for
 *             debugging or deep introspection.
 *
 * The three public functions are pure and dependency-free:
 *   - atLevel(item, level)        → the content for one item at a level
 *   - listForIndex(items)         → ALL items at L0, as a compact flat string
 *                                   for the system prompt / index
 *   - loadForTrigger(items, kw)   → only the items whose L0 matches the
 *                                   trigger keyword, returned at L1
 *
 * Anything Disclosable can be wrapped: DesignRecipe, skills, panelist
 * personas, critic rubrics, etc. The wrapper just fills level0/level1/(level2).
 */

/** Disclosure depth. Higher = more context, loaded less often. */
export type DisclosureLevel = 0 | 1 | 2

/**
 * A piece of context that can be surfaced at three granularities.
 * - id: stable identifier (also used for trigger matching when level0 has no colon)
 * - level0: ~50-token one-liner ("name: short description")
 * - level1: full body (skill text / recipe JSON)
 * - level2: optional deep reference (patch history, debug notes)
 */
export interface Disclosable {
  id: string
  level0: string
  level1: string
  level2?: string
}

/**
 * Return the content of a single item at the requested level.
 *
 * - L0 → level0 (always present)
 * - L1 → level1 (falls back to level0 if a caller forgot to fill the body,
 *        so the function never returns an empty string for a real item)
 * - L2 → level2 when present, otherwise falls back to level1, then level0
 *   (L2 is optional; asking for it on an item without it should still yield
 *   the deepest available content rather than nothing)
 */
export function atLevel(item: Disclosable, level: DisclosureLevel): string {
  if (level === 0) return item.level0 ?? ''
  if (level === 1) return item.level1?.trim() ? item.level1 : (item.level0 ?? '')
  // level === 2
  if (item.level2?.trim()) return item.level2
  if (item.level1?.trim()) return item.level1
  return item.level0 ?? ''
}

/**
 * Render ALL items at Level 0 as one compact, flat string for the system
 * prompt / index. Output is O(n) in item count but each line is tiny, so the
 * index stays cheap regardless of how many skills/recipes exist.
 *
 * Format: "Verfuegbar: X (desc), Y (desc), ..." joined into a single block,
 * one item per line for readability — the model treats newlines cheaply and
 * the caller can always .replace(/\n/g, ' ') if it wants a true single line.
 */
export function listForIndex(items: Disclosable[]): string {
  const lines = (items ?? [])
    .filter((it) => it && it.level0)
    .map((it) => `  - ${it.level0.trim()}`)
  if (lines.length === 0) return ''
  return `Verfuegbar:\n${lines.join('\n')}`
}

/**
 * Load on demand: find every item whose Level-0 (or id) mentions the trigger
 * keyword, and return their Level-1 bodies. This is the on-ramp that keeps
 * context flat — only matching skills are promoted into the prompt.
 *
 * Matching is intentionally lenient: case-insensitive substring match against
 * both the level0 text and the id. A trigger like "asian-spa" therefore hits
 * an item whose level0 is "asian-spa: gold/ivory spa aesthetic (Ø8.1)".
 *
 * Returns the bodies joined with a blank-line separator and a small header
 * per item so the model knows what it is looking at. Empty string when
 * nothing matches (the caller can then skip injecting anything).
 */
export function loadForTrigger(items: Disclosable[], trigger: string): string {
  const kw = (trigger ?? '').trim().toLowerCase()
  if (!kw) return ''

  const hits = (items ?? []).filter((it) => {
    if (!it) return false
    const hay0 = (it.level0 ?? '').toLowerCase()
    const hayId = (it.id ?? '').toLowerCase()
    return hay0.includes(kw) || hayId.includes(kw)
  })

  if (hits.length === 0) return ''

  const blocks = hits.map((it) => {
    const head = it.level0?.trim() || it.id
    const body = atLevel(it, 1)
    return `### ${head}\n${body}`
  })
  return blocks.join('\n\n')
}

// ---------------------------------------------------------------------------
// Convenience wrapper: turn a DesignRecipe (from skill-memory.ts) into a
// Disclosable so the recipe store plugs straight into the disclosure system.
// Kept here next to the core API so callers have one import; typed against a
// structural subset to avoid a hard dependency on skill-memory at import time.
// ---------------------------------------------------------------------------

/** Structural shape we need from a DesignRecipe to wrap it. */
interface RecipeLike {
  topic: string
  palette?: Record<string, string>
  fonts?: { display?: string; body?: string }
  layoutArchetype?: string
  soulGestures?: string[]
  praisedByPanelists?: string[]
  avoidPatterns?: string[]
  sourceComposite?: number
}

/**
 * Wrap a learned DesignRecipe as a Disclosable.
 *   level0 = "topic: palette/acrchetype aesthetic (Øcomposite)"
 *   level1 = full recipe JSON (pretty-printed)
 *   level2 = "patch history" placeholder — left to the caller to fill from the
 *            DesignLesson.version field; we expose a stable header so the
 *            caller can detect it.
 *
 * Pure / synchronous; never throws on partial recipes.
 */
export function recipeAsDisclosable(recipe: RecipeLike): Disclosable {
  const topic = (recipe.topic ?? 'untitled').trim() || 'untitled'
  const composite =
    typeof recipe.sourceComposite === 'number' && Number.isFinite(recipe.sourceComposite)
      ? recipe.sourceComposite
      : null
  const accentLabel = pickAccentLabel(recipe)
  const archetype = (recipe.layoutArchetype ?? '').trim()
  const moodBits = [accentLabel, archetype].filter(Boolean).join(' · ')
  const scoreBit = composite !== null ? ` (Ø${composite.toFixed(1)})` : ''

  const level0 = `${topic}: ${moodBits || 'learned recipe'}${scoreBit}`
  const level1 = JSON.stringify(recipe, null, 2)
  const level2 = `Patch history for "${topic}" — see DesignLesson.version (populate from store).`

  return { id: topic, level0, level1, level2 }
}

function pickAccentLabel(recipe: RecipeLike): string {
  const p = recipe.palette
  if (p && typeof p === 'object') {
    const accent =
      (p.accent as string | undefined) ||
      (p.bg as string | undefined) ||
      (p.surface as string | undefined)
    if (accent) return String(accent)
  }
  return ''
}
