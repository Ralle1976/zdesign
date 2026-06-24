/**
 * optimizer.ts — GEPA-style offline soul-guidance evolver (lean).
 *
 * One pass:
 *   1. Load current soul-guidance.md + recent traces (trace-store.readTraces).
 *   2. Read the designer panelist critiques from low-scoring traces to learn
 *      WHY recent designs under-performed on aesthetics.
 *   3. Ask the model to produce N MUTATED variants of the soul guidance that
 *      specifically target those weaknesses.
 *   4. Evaluate each variant: run ONE quick generate with a representative
 *      brief + the variant as soul guidance, then a single model-judge call
 *      scores the result's likely aesthetic strength (0-10).
 *   5. Baseline: judge the CURRENT guidance the same way (same brief).
 *   6. Keep the highest-scoring variant IF it beats the baseline; write it
 *      back to soul-guidance.md. Otherwise leave the guidance untouched.
 *
 * Defensive throughout: never throws — returns {ran:false,reason} on any error.
 * No external deps except fs + the injected `call` (callFusionText).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { readTraces } from '../skills/trace-store'

// Resolve the sibling soul-guidance.md in a module-system-agnostic way.
// `import.meta.url` works under Bun/ESM; the global __dirname fallback covers
// CJS. Either branch yields this file's own directory.
const here = (() => {
  try {
    // ESM / Bun
    const fileUrl = (import.meta as { url?: string }).url
    if (fileUrl) {
      // Use a dynamic require to get dirname without a static `__dirname` ref
      // (which TS flags as used-before-declaration under some configs).
      const { fileURLToPath } = require('url') as typeof import('url')
      const { dirname } = require('path') as typeof import('path')
      return dirname(fileURLToPath(fileUrl))
    }
  } catch {
    /* fall through to __dirname */
  }
  // CJS fallback
  return (typeof __dirname !== 'undefined' ? __dirname : process.cwd()) as string
})()

export const SOUL_GUIDANCE_PATH = resolve(here, 'soul-guidance.md')

export type FusionCall = (
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number },
) => Promise<string>

export interface GepaResult {
  ran: boolean
  kept?: boolean
  bestScore?: number
  oldScore?: number
  diff?: string
  reason?: string
  variantsTried?: number
}

/** A few representative briefs used to evaluate variants. Diverse enough that a
 *  mutated guidance must generalize, not just flatter one domain. */
const DEFAULT_BRIEFS = [
  'A landing page for a small Tokyo ramen shop that only seats 8 — warm, hand-made, slightly mysterious, open late.',
  'A pricing page for a developer-focused API analytics SaaS — precise, confident, technical-but-human, no enterprise clichés.',
  'A portfolio site for an independent type designer — maximal typographic confidence, almost no images, the work IS the page.',
]

/** Pull the aesthetic signal out of traces: the designer panelist's critiques
 *  (refinements + summary) from designs that scored poorly on aesthetics. The
 *  designer role weights AESTHETICS & SOUL in the Theater, so its refinements
 *  are the most direct "why did this feel generic" signal we have. */
function extractWeaknessSignal(traces: ReturnType<typeof readTraces>): string {
  const sorted = [...traces].sort((a, b) => a.composite - b.composite)
  const weakest = sorted.slice(0, 6)
  if (weakest.length === 0) return '(no traces yet — assume the guidance is too generic: safe palettes, centered layouts, generic microcopy, no memorable move.)'

  const lines: string[] = []
  for (const t of weakest) {
    const designer = t.perPanelist.find(
      (p) => p.role === 'designer' || p.role === 'Design',
    )
    const dScore = designer?.score ?? '?'
    const critiques: string[] = []
    if (designer?.summary) critiques.push(designer.summary)
    if (designer?.refinements?.length) critiques.push(...designer.refinements)
    if (critiques.length === 0) {
      // Fall back to any panelist critique on this trace.
      for (const p of t.perPanelist) {
        if (p.summary) critiques.push(`${p.role}: ${p.summary}`)
        if (p.refinements?.length) critiques.push(...p.refinements)
      }
    }
    if (critiques.length === 0) continue
    lines.push(
      `- Composite ${t.composite} (designer ${dScore}) on "${t.topic || t.brief.slice(0, 80)}": ` +
        critiques.slice(0, 4).join(' | '),
    )
  }
  if (lines.length === 0) {
    return '(traces exist but carried no designer critiques — assume generic design defaults.)'
  }
  return lines.join('\n')
}

/** Parse N markdown variants out of the model's response. Each variant is a
 *  fenced block OR separated by an explicit "## VARIANT" delimiter. We try
 *  fences first, then delimiter split, then (fallback) treat the whole blob as
 *  a single variant. Always returns >= 0 strings. */
function parseVariants(raw: string, want: number): string[] {
  if (!raw) return []
  const fenceRe = /```(?:markdown|md)?\s*([\s\S]*?)```/gi
  const fenced: string[] = []
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(raw)) !== null) {
    const body = (m[1] || '').trim()
    if (body.length > 40) fenced.push(body)
  }
  if (fenced.length >= want) return fenced.slice(0, want)
  if (fenced.length > 0) return fenced

  const split = raw.split(/\n\s*#{1,4}\s*VARIANT\s*\d*/i)
  const cleaned = split
    .map((s) => s.trim())
    .filter((s) => s.length > 80)
  if (cleaned.length > 1) return cleaned.slice(0, want)

  const whole = raw.trim()
  return whole.length > 80 ? [whole] : []
}

/** Pull a 0-10 number out of a judge response. The judge is instructed to
 *  reply "Score: <n>/10 — reason", so we FIRST look for a number anchored to a
 *  score marker (Score:/Punkte:/grade/## N / N/10 / N out of 10). Only if no
 *  anchored match is found do we fall back to the first standalone 0-10 token.
 *  Defaults to null if nothing parseable — caller treats null as a non-improvement.
 *
 *  The anchoring matters because model commentary can leak stray numbers
 *  ("GPT-4", "2024") that would otherwise be misread as the score. */
function parseJudgeScore(raw: string): number | null {
  if (!raw) return null

  const toNum = (s: string): number => parseFloat(s.replace(',', '.'))
  const inRange = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 10

  // Anchored patterns (tried in priority order). The capture group is the score.
  const anchored: RegExp[] = [
    /(?:score|punkte|grade|bewertung|rating)\s*[:=]?\s*(\d(?:[.,]\d+)?)/i,
    /\b(\d(?:[.,]\d+)?)\s*\/\s*10\b/, // "7.5/10"
    /\b(\d(?:[.,]\d+)?)\s*out\s+of\s+10\b/i,
    /^#\s*(\d(?:[.,]\d+)?)\b/im, // "# 7.5"
  ]
  for (const re of anchored) {
    const m = raw.match(re)
    if (m && m[1]) {
      const n = toNum(m[1])
      if (inRange(n)) return n
    }
  }

  // Fallback: first 0-10 token preceded by whitespace, line-start, or a
  // delimiter like ":" or "=" — explicitly NOT a hyphen, so "GPT-4" can't be
  // misread as the score. (The anchored path above handles the normal
  // "Score: N/10" reply; this only fires for unusual judge phrasings.)
  const standalone = raw.match(/(?<=^|[\s:=])\d(?:[.,]\d+)?(?=\b)/g)
  if (standalone) {
    for (const tok of standalone) {
      const n = toNum(tok)
      if (inRange(n)) return n
    }
  }
  return null
}

function variantMutatePrompt(
  currentGuidance: string,
  weaknessSignal: string,
  want: number,
): string {
  return [
    `You are evolving the "soul guidance" that steers an AI design agent away from generic output.`,
    `This is an offline GEPA-style optimization step. Your job is to MUTATE the current guidance so the agent's NEXT designs fix the aesthetic weaknesses seen in real critique traces.`,
    ``,
    `--- CURRENT SOUL GUIDANCE ---`,
    currentGuidance.trim(),
    ``,
    `--- WHY RECENT DESIGNS UNDER-PERFORMED (real designer critiques, lowest composite first) ---`,
    weaknessSignal,
    ``,
    `Produce ${want} DISTINCT mutated variants of the soul guidance. Each variant must:`,
    `- Stay ~120 words, plain markdown, the SAME section spirit (bold visual move / microcopy voice / micro-interaction / detail only a real user adds / identifiable-from-a-screenshot test).`,
    `- Specifically target at least 2 of the weaknesses above (cite the concrete fix in the new wording — e.g. if traces say "centered trio, no hierarchy", the variant must forbid that and name the move that replaces it).`,
    `- Be more specific and more uncompromising than the current version — never softer.`,
    `- Each variant must be genuinely different from the others and from the current guidance (different bold move, different voice rule, different micro-interaction).`,
    ``,
    `Output each variant inside a single \`\`\`markdown fenced block. Label them:`,
    `\`\`\`markdown`,
    `## VARIANT 1`,
    `<variant body>`,
    `\`\`\``,
    `Repeat for VARIANT ${want === 1 ? '' : '2 '}. No prose outside the fences.`,
  ].join('\n')
}

function generatePrompt(soulGuidance: string, brief: string): string {
  return [
    `You are an art-director-grade design agent. Generate a COMPLETE, self-contained HTML document (single page, inline CSS, no external assets, <!doctype html> ... </html>) for this brief.`,
    ``,
    `--- BRIEF ---`,
    brief,
    ``,
    `--- SOUL GUIDANCE (follow this to the letter — it defines the 20% that makes the page distinctive) ---`,
    soulGuidance.trim(),
    ``,
    `Return ONLY the HTML document. No prose, no fences, no commentary.`,
  ].join('\n')
}

function judgePrompt(brief: string, html: string): string {
  return [
    `You are a ruthless senior art director grading ONE HTML page on AESTHETIC STRENGTH only (not accessibility, not copy correctness — purely: is this distinctive, confident, non-generic, does it have a bold ownable move?).`,
    ``,
    `--- BRIEF THE PAGE WAS FOR ---`,
    brief,
    ``,
    `--- HTML (truncated) ---`,
    html.slice(0, 6000),
    ``,
    `Grade the aesthetic strength 0-10. 10 = a senior AD would defend it; identifiable from a screenshot. 5 = competent but generic. 0 = template slop.`,
    `Reply with ONE line in the form: Score: <number>/10 — <one short reason>.`,
  ].join('\n')
}

/** Judge a single soul-guidance variant by generating one quick design with it
 *  and scoring the result. Returns null if any step fails or yields no score. */
async function scoreVariant(
  call: FusionCall,
  soulGuidance: string,
  brief: string,
): Promise<number | null> {
  try {
    const html = await call(generatePrompt(soulGuidance, brief), {
      maxTokens: 8192,
      temperature: 0.5,
    })
    if (!html || html.trim().length < 200) return null
    const judgeRaw = await call(judgePrompt(brief, html), {
      maxTokens: 200,
      temperature: 0.1,
    })
    return parseJudgeScore(judgeRaw)
  } catch (e) {
    console.warn(
      '[gepa] scoreVariant failed:',
      e instanceof Error ? e.message : e,
    )
    return null
  }
}

/**
 * Run one GEPA optimization pass. Reads soul-guidance.md + traces, mutates,
 * evaluates, and keeps the best variant if it beats the current baseline.
 *
 * @param call the Fusion text caller (callFusionText).
 * @param opts.briefs optional representative briefs (defaults to a diverse set).
 * @param opts.variants number of variants to mutate (default 2).
 */
export async function runGepaOptimizer(
  call: FusionCall,
  opts?: { briefs?: string[]; variants?: number },
): Promise<GepaResult> {
  try {
    if (!existsSync(SOUL_GUIDANCE_PATH)) {
      return { ran: false, reason: 'soul-guidance.md not found' }
    }
    const current = readFileSync(SOUL_GUIDANCE_PATH, 'utf8')
    if (!current || current.trim().length < 40) {
      return { ran: false, reason: 'soul-guidance.md is empty' }
    }

    const briefs = opts?.briefs && opts.briefs.length > 0 ? opts.briefs : DEFAULT_BRIEFS
    const want = Math.max(1, Math.min(4, opts?.variants ?? 2))
    const probeBrief = briefs[0]

    // Baseline: judge the CURRENT guidance so we only mutate if a variant wins.
    const oldScore = await scoreVariant(call, current, probeBrief)
    if (oldScore === null) {
      return { ran: false, reason: 'baseline judge call produced no score' }
    }

    // Read recent traces + extract the designer-critique weakness signal.
    const traces = readTraces()
    const weaknessSignal = extractWeaknessSignal(traces)

    // Mutate: produce N variants targeting the weaknesses.
    const variantRaw = await call(
      variantMutatePrompt(current, weaknessSignal, want),
      { maxTokens: 4096, temperature: 0.7 },
    )
    const variants = parseVariants(variantRaw, want)
    if (variants.length === 0) {
      return { ran: false, reason: 'mutation produced no usable variants' }
    }

    // Evaluate each variant against a (rotating) representative brief.
    const scored: Array<{ guidance: string; score: number }> = []
    for (let i = 0; i < variants.length; i++) {
      const brief = briefs[i % briefs.length]
      const score = await scoreVariant(call, variants[i], brief)
      if (score !== null) scored.push({ guidance: variants[i], score })
    }
    if (scored.length === 0) {
      return {
        ran: false,
        reason: 'no variant produced a judgeable score',
        oldScore,
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const best = scored[0]

    // Keep only if strictly better than baseline.
    const kept = best.score > oldScore
    if (kept) {
      try {
        writeFileSync(SOUL_GUIDANCE_PATH, best.guidance + '\n', 'utf8')
      } catch (e) {
        return {
          ran: false,
          reason: `write-back failed: ${e instanceof Error ? e.message : e}`,
          bestScore: best.score,
          oldScore,
        }
      }
    }

    const diff =
      best.guidance.slice(0, 220).replace(/\s+/g, ' ').trim() +
      (best.guidance.length > 220 ? '…' : '')

    return {
      ran: true,
      kept,
      bestScore: best.score,
      oldScore,
      diff,
      variantsTried: scored.length,
    }
  } catch (e) {
    return {
      ran: false,
      reason: e instanceof Error ? e.message : String(e),
    }
  }
}
