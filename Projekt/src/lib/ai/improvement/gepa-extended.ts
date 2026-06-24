/**
 * gepa-extended.ts — I6: GEPA for ANY skill, not just soul-guidance.
 *
 * The base optimizer (../gepa/optimizer.ts) evolves ONE file: soul-guidance.md.
 * This module lifts the same mutate→judge→keep loop to ANY skill a target
 * describes — generate prompts, panelist rubrics, audit rules, creative-
 * director seed text, art-direction tokens, etc.
 *
 * For each GepaTarget it:
 *   1. Reads the current content (the skill file body).
 *   2. Asks `call` to produce 2 mutated variants that keep the file's spirit.
 *   3. Evaluates each variant: `call` with the variant + a representative
 *      brief → a second `call` judges the output 0-10.
 *   4. Also baselines the CURRENT content the same way.
 *   5. Keeps the highest-scoring variant IF it beats the current; writes the
 *      winner back to filePath.
 *
 * Defensive throughout: a missing file, a failed call, or an unparseable judge
 * score skips that target (logged, never thrown). The result array mirrors the
 * targets so callers can map target ↔ outcome by index/skillId.
 *
 * No external deps beyond fs + the injected `call` (callFusionText shape).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

// ─── Import the base optimizer (for reuse of runGepaOptimizer if callers want
//     the soul-guidance-only pass). We import defensively so a missing or
//     renamed optimizer never breaks this module — see the catch below. ───────

type BaseRunFn = (
  call: (prompt: string, opts?: { maxTokens?: number; temperature?: number }) => Promise<string>,
  opts?: { briefs?: string[]; variants?: number },
) => Promise<{ ran: boolean; kept?: boolean; bestScore?: number; oldScore?: number; reason?: string }>

let runGepaOptimizer: BaseRunFn | null = null
try {
  // Dynamic to avoid a hard build-time dependency if the base optimizer moves.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('../gepa/optimizer') as { runGepaOptimizer?: BaseRunFn }
  // (from src/lib/ai/improvement/ → ../gepa/optimizer.ts resolves correctly
  //  because gepa/ is a sibling of improvement/ under src/lib/ai/)
  if (mod && typeof mod.runGepaOptimizer === 'function') {
    runGepaOptimizer = mod.runGepaOptimizer
  }
} catch {
  runGepaOptimizer = null
}

/** If the base optimizer exists, expose it; otherwise return a stub. */
export async function runBaseGepa(
  call: (prompt: string, opts?: { maxTokens?: number; temperature?: number }) => Promise<string>,
  opts?: { briefs?: string[]; variants?: number },
): Promise<{ ran: boolean; kept?: boolean; bestScore?: number; oldScore?: number; reason?: string }> {
  if (runGepaOptimizer) {
    try {
      return await runGepaOptimizer(call, opts)
    } catch (e) {
      return { ran: false, reason: `base gepa failed: ${e instanceof Error ? e.message : e}` }
    }
  }
  console.info('[gepa-extended] base runGepaOptimizer unavailable — stub returning {ran:false}.')
  return { ran: false, reason: 'base optimizer not present' }
}

// ─── Public types ──────────────────────────────────────────────────────────

export type GepaCall = (
  prompt: string,
  opts?: { maxTokens?: number; temperature?: number },
) => Promise<string>

export interface GepaTarget {
  /** Stable id of the skill (e.g. 'generate-prompt', 'audit-rules'). */
  skillId: string
  /** Current file content. If empty, we attempt to read from filePath. */
  currentContent: string
  /** Absolute path to the skill file we mutate + write back. */
  filePath: string
  /**
   * Optional metric. If provided, the variant's call OUTPUT is passed through
   * this instead of the default judge-call. Default behaviour (when omitted)
   * uses the built-in 0-10 judge prompt below. Kept on the interface so a
   * caller can plug in a deterministic scorer (e.g. the audit linter) for
   * skills where a model judge is the wrong tool.
   */
  evalMetric?: (signal: any) => number
}

export interface GepaTargetResult {
  skillId: string
  kept: boolean
  oldScore: number
  newScore: number
}

// ─── Prompts ────────────────────────────────────────────────────────────────

/** A single diverse probe brief used to evaluate each variant. The caller can
 *  override per-target via the filePath heuristic below, but a good default
 *  keeps the loop honest across skill kinds. */
const DEFAULT_PROBE_BRIEF =
  'A landing page for a small independent specialty coffee roaster — confident, editorial, warm-but-precise, no stock-photo clichés.'

function mutatePrompt(skillId: string, current: string): string {
  return [
    `You are evolving the "${skillId}" skill used by an AI design agent.`,
    `This is an offline GEPA-style optimization step. Mutate the current skill content so the agent's NEXT outputs are MORE distinctive and LESS generic, without breaking the skill's purpose.`,
    ``,
    `--- CURRENT "${skillId}" CONTENT ---`,
    current.trim(),
    ``,
    `Produce 2 DISTINCT mutated variants. Each variant must:`,
    `- Keep the SAME intent and section structure as the current content.`,
    `- Be MORE specific and MORE uncompromising — never softer or more generic.`,
    `- Add at least one concrete, named move the current version lacks.`,
    `- Be genuinely different from each other.`,
    ``,
    `Output each variant inside its own \`\`\`markdown fenced block, labelled:`,
    `\`\`\`markdown`,
    `## VARIANT 1`,
    `<body>`,
    `\`\`\``,
    `\`\`\`markdown`,
    `## VARIANT 2`,
    `<body>`,
    `\`\`\``,
    `No prose outside the fences.`,
  ].join('\n')
}

function applyPrompt(skillId: string, variant: string, brief: string): string {
  return [
    `You are an art-director-grade design agent. Use the "${skillId}" skill below to produce a COMPLETE, self-contained HTML document (single page, inline CSS, <!doctype html> ... </html>) for this brief.`,
    ``,
    `--- BRIEF ---`,
    brief,
    ``,
    `--- "${skillId}" SKILL (follow to the letter) ---`,
    variant.trim(),
    ``,
    `Return ONLY the HTML document. No prose, no fences, no commentary.`,
  ].join('\n')
}

function judgePrompt(skillId: string, brief: string, html: string): string {
  return [
    `You are a ruthless senior art director. The design agent just used its "${skillId}" skill to produce the HTML below. Grade the AESTHETIC STRENGTH of the RESULT (0-10) — not the skill text, the page it produced.`,
    ``,
    `--- BRIEF ---`,
    brief,
    ``,
    `--- HTML (truncated) ---`,
    html.slice(0, 6000),
    ``,
    `10 = distinctive, ownable, a senior AD would defend it. 5 = competent but generic. 0 = template slop.`,
    `Reply with ONE line: Score: <number>/10 — <one short reason>.`,
  ].join('\n')
}

// ─── Parsing helpers (mirrors the base optimizer's robust parsing) ──────────

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

  const split = raw
    .split(/\n\s*#{1,4}\s*VARIANT\s*\d*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 80)
  if (split.length > 1) return split.slice(0, want)

  const whole = raw.trim()
  return whole.length > 80 ? [whole] : []
}

function parseJudgeScore(raw: string): number | null {
  if (!raw) return null
  const toNum = (s: string): number => parseFloat(s.replace(',', '.'))
  const inRange = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 10
  const anchored: RegExp[] = [
    /(?:score|punkte|grade|bewertung|rating)\s*[:=]?\s*(\d(?:[.,]\d+)?)/i,
    /\b(\d(?:[.,]\d+)?)\s*\/\s*10\b/,
    /\b(\d(?:[.,]\d+)?)\s*out\s+of\s+10\b/i,
    /^#\s*(\d(?:[.,]\d+)?)\b/im,
  ]
  for (const re of anchored) {
    const m = raw.match(re)
    if (m && m[1]) {
      const n = toNum(m[1])
      if (inRange(n)) return n
    }
  }
  const standalone = raw.match(/(?<=^|[\s:=])\d(?:[.,]\d+)?(?=\b)/g)
  if (standalone) {
    for (const tok of standalone) {
      const n = toNum(tok)
      if (inRange(n)) return n
    }
  }
  return null
}

// ─── Core: score one skill-content variant against a brief ──────────────────

async function scoreVariant(
  call: GepaCall,
  skillId: string,
  content: string,
  brief: string,
  evalMetric?: (signal: any) => number,
): Promise<number | null> {
  try {
    const html = await call(applyPrompt(skillId, content, brief), {
      maxTokens: 8192,
      temperature: 0.5,
    })
    if (!html || html.trim().length < 200) return null

    // If the target supplies a deterministic evalMetric, run it on the raw
    // output instead of a second model call. A non-finite metric is ignored.
    if (evalMetric) {
      try {
        const metricScore = evalMetric(html)
        if (typeof metricScore === 'number' && Number.isFinite(metricScore)) {
          return metricScore
        }
      } catch {
        /* fall through to model judge */
      }
    }

    const judgeRaw = await call(judgePrompt(skillId, brief, html), {
      maxTokens: 200,
      temperature: 0.1,
    })
    return parseJudgeScore(judgeRaw)
  } catch (e) {
    console.warn(
      '[gepa-extended] scoreVariant failed:',
      e instanceof Error ? e.message : e,
    )
    return null
  }
}

/** Resolve the current content for a target: prefer currentContent, fall back
 *  to reading filePath, then to '' (which skips the target upstream). */
function resolveCurrent(target: GepaTarget): string {
  if (target.currentContent && target.currentContent.trim().length > 0) {
    return target.currentContent
  }
  try {
    if (target.filePath && existsSync(target.filePath)) {
      return readFileSync(target.filePath, 'utf8')
    }
  } catch {
    /* ignore — empty string will skip the target */
  }
  return ''
}

/** Write the winning content back to filePath (mkdir best-effort). Never throws. */
function writeBack(filePath: string, content: string): boolean {
  try {
    if (!filePath) return false
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        /* race / perms */
      }
    }
    writeFileSync(filePath, content + '\n', 'utf8')
    return true
  } catch (e) {
    console.warn(
      '[gepa-extended] writeBack failed:',
      e instanceof Error ? e.message : e,
    )
    return false
  }
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Run an extended GEPA pass over every target. For each target:
 *   - read current content (currentContent, else filePath, else skip),
 *   - baseline-score the current content,
 *   - generate 2 mutated variants via call(),
 *   - score each variant,
 *   - keep the best variant if it beats the baseline → write back to filePath.
 *
 * Returns a result per target (kept / oldScore / newScore). Missing files,
 * failed calls, or unparseable scores skip that target gracefully. Never throws.
 *
 * @param targets the skills to evolve.
 * @param call    the Fusion text caller (callFusionText shape).
 */
export async function runExtendedGepa(
  targets: GepaTarget[],
  call: GepaCall,
): Promise<{
  results: GepaTargetResult[]
}> {
  const results: GepaTargetResult[] = []
  if (!Array.isArray(targets) || targets.length === 0) {
    return { results }
  }
  if (typeof call !== 'function') {
    return { results }
  }

  for (const target of targets) {
    try {
      if (!target || !target.skillId) continue
      const current = resolveCurrent(target)
      if (current.trim().length < 40) {
        console.info(
          `[gepa-extended] skip ${target.skillId}: content empty or missing (${target.filePath || 'no filePath'}).`,
        )
        results.push({ skillId: target.skillId, kept: false, oldScore: 0, newScore: 0 })
        continue
      }

      const brief = DEFAULT_PROBE_BRIEF

      // 1. Baseline the current content.
      const oldScore = await scoreVariant(call, target.skillId, current, brief, target.evalMetric)
      if (oldScore === null) {
        console.info(
          `[gepa-extended] skip ${target.skillId}: baseline produced no score.`,
        )
        results.push({ skillId: target.skillId, kept: false, oldScore: 0, newScore: 0 })
        continue
      }

      // 2. Mutate.
      const mutateRaw = await call(mutatePrompt(target.skillId, current), {
        maxTokens: 4096,
        temperature: 0.7,
      })
      const variants = parseVariants(mutateRaw, 2)
      if (variants.length === 0) {
        console.info(
          `[gepa-extended] skip ${target.skillId}: mutation produced no variants.`,
        )
        results.push({ skillId: target.skillId, kept: false, oldScore, newScore: oldScore })
        continue
      }

      // 3. Score each variant.
      const scored: Array<{ content: string; score: number }> = []
      for (const variant of variants) {
        const score = await scoreVariant(call, target.skillId, variant, brief, target.evalMetric)
        if (score !== null) scored.push({ content: variant, score })
      }
      if (scored.length === 0) {
        console.info(
          `[gepa-extended] skip ${target.skillId}: no variant produced a score.`,
        )
        results.push({ skillId: target.skillId, kept: false, oldScore, newScore: oldScore })
        continue
      }

      scored.sort((a, b) => b.score - a.score)
      const best = scored[0]

      // 4. Keep only if strictly better than the baseline.
      const kept = best.score > oldScore
      if (kept) {
        const wrote = writeBack(target.filePath, best.content)
        if (!wrote) {
          // Could not persist — treat as not kept so callers don't think it shipped.
          results.push({ skillId: target.skillId, kept: false, oldScore, newScore: best.score })
          continue
        }
        console.info(
          `[gepa-extended] KEPT new "${target.skillId}" variant: ${best.score} > baseline ${oldScore} → ${target.filePath}`,
        )
      } else {
        console.info(
          `[gepa-extended] held "${target.skillId}": best ${best.score} <= baseline ${oldScore}.`,
        )
      }
      results.push({ skillId: target.skillId, kept, oldScore, newScore: best.score })
    } catch (e) {
      console.warn(
        `[gepa-extended] target ${target?.skillId ?? '?'} failed:`,
        e instanceof Error ? e.message : e,
      )
      results.push({
        skillId: target?.skillId ?? '',
        kept: false,
        oldScore: 0,
        newScore: 0,
      })
    }
  }

  return { results }
}
