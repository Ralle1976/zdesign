/**
 * context-manager.ts — M3: Token-aware context window manager.
 *
 * Assembles, trims, and formats the prompt context handed to an LLM so that
 * long-running design loops (src/app/api/design/agent/route.ts) stay inside the
 * model's context window. Pure heuristic budgeting — no external deps, no model
 * calls. The agent route can call buildContext() each turn, check shouldTrim(),
 * and either send as-is or rely on the internal sliding-window trim.
 *
 * Heuristic: ~4 chars per token (chars/4). This is the standard rough estimate
 * for English/code mixed with markdown; it errs slightly high, which is the safe
 * direction for a context manager.
 *
 * No external dependencies.
 */

/** A single chat turn, OpenAI-style. */
export interface ChatTurn {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

/** Output of buildContext(): everything the caller needs to render a prompt. */
export interface ManagedContext {
  /** Immutable system prompt (art direction, role, skills). Always kept. */
  system: string;
  /** Long-lived user preferences / project memory, folded between system and volatile. */
  userPrefs: string;
  /** Per-turn volatile payload (current ArtBrief, latest critique, scratch state). */
  volatile: string;
  /** Surviving chat history after sliding-window trim. */
  history: ChatTurn[];
  /** Sum of estimateTokens over system + userPrefs + volatile + all history turns. */
  totalEstimated: number;
  /** The budget buildContext() was told to respect. */
  maxTokens: number;
}

/** Default ceiling when the caller doesn't pass one. Z.ai/GLM-4.x ~128k window;
 *  we default conservatively to leave headroom for the model's own output. */
export const DEFAULT_MAX_TOKENS = 96_000;

/** Always keep at least this many most-recent turns, even if doing so blows the
 *  budget — losing the latest user/assistant exchange corrupts the loop. */
export const MIN_RETAINED_TURNS = 3;

/**
 * Rough token estimate: chars/4. Trailing fractional tokens round up so tiny
 * strings still count as one token rather than zero.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Sum of token estimates for a set of turns (role + content each). */
function estimateTurns(turns: ChatTurn[]): number {
  let total = 0;
  for (const t of turns) {
    // Role label + a delimiter adds a small constant overhead per turn.
    total += estimateTokens(`${t.role}:${t.content}`);
  }
  return total;
}

/**
 * Assemble a ManagedContext, trimming history with a sliding window so the whole
 * context fits under maxTokens (minus the reserved output budget).
 *
 * Budget math:
 *   fixedCost  = tokens(system) + tokens(userPrefs) + tokens(volatile)
 *   historyCap = maxTokens - reserved - fixedCost
 * History is trimmed (oldest first, always retaining the last MIN_RETAINED_TURNS)
 * until estimateTurns(history) <= historyCap.
 *
 * If even the fixed parts exceed maxTokens - reserved, history is reduced to the
 * minimum retained turns and totalEstimated is reported honestly (it will exceed
 * maxTokens — shouldTrim() will flag it so the caller can react).
 */
export function buildContext(opts: {
  system: string;
  userPrefs?: string;
  volatile: string;
  history: ChatTurn[];
  /** Total window budget. Defaults to DEFAULT_MAX_TOKENS. */
  maxTokens?: number;
  /** Tokens to reserve for the model's response (subtracted from the budget).
   *  Defaults to maxTokens * 0.2 (20% headroom). */
  reserved?: number;
}): ManagedContext {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const reserved =
    opts.reserved ?? Math.floor(maxTokens * 0.2);
  const userPrefs = opts.userPrefs ?? "";

  const systemTokens = estimateTokens(opts.system);
  const userPrefsTokens = estimateTokens(userPrefs);
  const volatileTokens = estimateTokens(opts.volatile);
  const fixedCost = systemTokens + userPrefsTokens + volatileTokens;

  const historyCap = Math.max(0, maxTokens - reserved - fixedCost);
  const history = trimHistory(opts.history, historyCap, reserved);

  const totalEstimated =
    fixedCost + estimateTurns(history);

  return {
    system: opts.system,
    userPrefs,
    volatile: opts.volatile,
    history,
    totalEstimated,
    maxTokens,
  };
}

/**
 * Should the caller trim or otherwise shed load? True once the assembled context
 * crosses 80% of the budget — the point at which a single large model reply
 * could overflow the window.
 */
export function shouldTrim(ctx: ManagedContext): boolean {
  return ctx.totalEstimated > ctx.maxTokens * 0.8;
}

/**
 * Sliding-window trim: drop the OLDEST turns until the surviving history fits in
 * `maxTokens - reserved`. The most recent MIN_RETAINED_TURNS are never removed,
 * even if they alone exceed the budget (better to overflow than to lose the
 * active exchange; shouldTrim() will still flag it).
 *
 * `maxTokens` here is the budget available FOR THE WHOLE CONTEXT (the same value
 * passed to buildContext); `reserved` is the output headroom. The fixed
 * system/userPrefs/volatile cost is the caller's responsibility and is NOT
 * re-derived here — trimHistory operates purely on history tokens against
 * (maxTokens - reserved). buildContext() passes the already-reduced historyCap
 * as maxTokens so the two compose cleanly.
 */
export function trimHistory(
  history: ChatTurn[],
  maxTokens: number,
  reserved: number
): ChatTurn[] {
  if (history.length === 0) return [];

  const budget = Math.max(0, maxTokens - reserved);
  let working = history.slice(); // newest at the end
  let cost = estimateTurns(working);

  if (cost <= budget) return working;

  // Peel oldest turns while we're over budget AND keeping >= MIN_RETAINED_TURNS.
  while (
    working.length > MIN_RETAINED_TURNS &&
    cost > budget
  ) {
    working.shift();
    cost = estimateTurns(working);
  }

  return working;
}

/**
 * Flatten the managed context into a single prompt string. History turns are
 * rendered as `role: content` blocks separated by blank lines, with system,
 * userPrefs, and volatile prepended. Useful for providers that take one string
 * rather than a message array (the Z.ai direct path).
 */
export function formatForModel(ctx: ManagedContext): string {
  const parts: string[] = [];

  if (ctx.system) parts.push(ctx.system);
  if (ctx.userPrefs) parts.push(ctx.userPrefs);
  if (ctx.volatile) parts.push(ctx.volatile);

  const histBlock = ctx.history
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n\n");
  if (histBlock) parts.push(histBlock);

  return parts.join("\n\n---\n\n");
}
