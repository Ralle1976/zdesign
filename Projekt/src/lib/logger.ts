/**
 * logger.ts — Structured observability for Z.Design (F0).
 *
 * Two responsibilities, both DB-backed and NEVER-throwing:
 *   - logError(level, component, message, context?)  → ErrorLog row
 *   - logTokens(model, purpose, in, out, cached, projectId?) → TokenLog row
 *
 * Every call is wrapped in try/catch. Logging must never break the request
 * path that triggered it. Falls back to console.* if the DB is unreachable.
 *
 * Replaces the scattered console.warn / console.error callsites in the
 * design-agent route and callZai.
 */

import { db } from '@/lib/db';

export type LogLevel = 'error' | 'warn' | 'info';

/**
 * Persist an error/warn/info event to the ErrorLog table.
 * Also mirrors to console so it still shows in dev/server logs.
 *
 * @param level     error | warn | info (default 'error')
 * @param component logical component, e.g. 'design/agent', 'callZai', 'chat'
 * @param message   human-readable message
 * @param context   optional structured context — stringified to JSON
 * @param projectId optional project scope
 */
export async function logError(
  level: LogLevel,
  component: string,
  message: string,
  context?: Record<string, unknown>,
  projectId?: string
): Promise<void> {
  // Always mirror to console (keeps existing dev-log behaviour).
  const fn =
    level === 'error' ? console.error : level === 'warn' ? console.warn : console.info;
  try {
    fn(`[${component}] ${message}`, context ?? '');
  } catch {
    /* console may fail in edge runtimes — ignore */
  }

  try {
    await db.errorLog.create({
      data: {
        level,
        component,
        message: String(message).slice(0, 2000),
        context: context ? JSON.stringify(context).slice(0, 8000) : null,
        projectId: projectId ?? null,
      },
    });
  } catch {
    // DB unavailable — the console mirror above is the safety net.
    // Do NOT rethrow: logging must never break the caller.
  }
}

/**
 * Persist a token-usage record to the TokenLog table.
 *
 * @param model     model id, e.g. 'glm-5.2'
 * @param purpose   what the call was for, e.g. 'design/agent.generate', 'theater.panelist'
 * @param inputTokens    usage.input_tokens (prompt tokens)
 * @param outputTokens   usage.output_tokens (completion tokens)
 * @param cachedTokens   usage.cache_read_input_tokens / cached tokens (0 if none)
 * @param projectId optional project scope
 * @param batchId   optional correlation id grouping a multi-call flow
 */
export async function logTokens(
  model: string,
  purpose: string,
  inputTokens: number,
  outputTokens: number,
  cachedTokens = 0,
  projectId?: string,
  batchId?: string
): Promise<void> {
  try {
    await db.tokenLog.create({
      data: {
        model: String(model),
        purpose: String(purpose),
        inputTokens: Number(inputTokens) || 0,
        outputTokens: Number(outputTokens) || 0,
        cachedTokens: Number(cachedTokens) || 0,
        projectId: projectId ?? null,
        batchId: batchId ?? null,
      },
    });
  } catch {
    // DB unavailable — never break the caller.
  }
}
