/**
 * trace-store.ts — Append-only JSONL trace store for the GEPA offline evolver.
 *
 * Every shipped agent design appends one trace (topic, brief, the final HTML
 * truncated, the composite, and the per-panelist scores + critiques + the
 * refinements the designer asked for). The GEPA optimizer reads these back to
 * learn WHY recent designs under-performed on aesthetics and mutate the soul
 * guidance to address it.
 *
 * Storage: process.env.TRACES_PATH || '/home/tango/zdesign-db/traces.jsonl'
 * Never throws — every public function wraps in try/catch and degrades
 * gracefully (a trace-store failure must never break a design response).
 */
import { appendFileSync, existsSync, readFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'

export interface TracePanelist {
  role: string
  score: number
  /** Short German diagnosis from the panelist (summary). */
  summary?: string
  /** Concrete actionable refinements the panelist requested. */
  refinements?: string[]
}

export interface DesignTrace {
  topic: string
  brief: string
  /** Final shipped HTML, truncated to keep the file bounded. */
  html: string
  composite: number
  perPanelist: TracePanelist[]
  ts: string
}

const DEFAULT_PATH = process.env.TRACES_PATH || './data/traces.jsonl'

function tracesPath(): string {
  return process.env.TRACES_PATH || DEFAULT_PATH
}

/** Append one trace to the JSONL store. Never throws. */
export function appendTrace(trace: {
  topic: string
  brief: string
  html: string
  composite: number
  perPanelist: TracePanelist[]
  ts?: string
}): void {
  try {
    const path = tracesPath()
    const dir = dirname(path)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        /* dir creation race / perms — best effort, the append below will still try */
      }
    }
    const record: DesignTrace = {
      topic: String(trace.topic ?? ''),
      brief: String(trace.brief ?? '').slice(0, 2000),
      html: String(trace.html ?? '').slice(0, 8000),
      composite:
        typeof trace.composite === 'number' && Number.isFinite(trace.composite)
          ? trace.composite
          : 0,
      perPanelist: Array.isArray(trace.perPanelist)
        ? trace.perPanelist
            .filter((p) => p && typeof p === 'object')
            .slice(0, 8)
            .map((p) => ({
              role: String(p.role ?? ''),
              score:
                typeof p.score === 'number' && Number.isFinite(p.score)
                  ? p.score
                  : 0,
              ...(p.summary ? { summary: String(p.summary).slice(0, 600) } : {}),
              ...(Array.isArray(p.refinements)
                ? {
                    refinements: p.refinements
                      .map((r: unknown) => String(r))
                      .filter((s: string) => s.length > 0)
                      .slice(0, 6),
                  }
                : {}),
            }))
        : [],
      ts: trace.ts || new Date().toISOString(),
    }
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8')
  } catch (e) {
    console.warn('[trace-store] appendTrace failed:', e instanceof Error ? e.message : e)
  }
}

/** Read + parse all traces, optionally filtered by topic. Never throws. */
export function readTraces(topic?: string): DesignTrace[] {
  try {
    const path = tracesPath()
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf8')
    const lines = raw.split(/\r?\n/)
    const out: DesignTrace[] = []
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        const parsed = JSON.parse(trimmed) as Partial<DesignTrace>
        if (!parsed || typeof parsed !== 'object') continue
        const trace: DesignTrace = {
          topic: String(parsed.topic ?? ''),
          brief: String(parsed.brief ?? ''),
          html: String(parsed.html ?? ''),
          composite:
            typeof parsed.composite === 'number' && Number.isFinite(parsed.composite)
              ? parsed.composite
              : 0,
          perPanelist: Array.isArray(parsed.perPanelist)
            ? parsed.perPanelist.filter((p) => p && typeof p === 'object')
            : [],
          ts: String(parsed.ts ?? ''),
        }
        if (topic && trace.topic !== topic) continue
        out.push(trace)
      } catch {
        /* skip malformed line — never let one bad row abort the read */
      }
    }
    return out
  } catch (e) {
    console.warn('[trace-store] readTraces failed:', e instanceof Error ? e.message : e)
    return []
  }
}
