/**
 * provider.ts — F1: Provider-Abstraktion.
 *
 * A single callLLM() interface that routes to the active provider. Today the
 * only concrete provider is ZaiProvider (wrapping the proven callZai path in
 * ./zai-direct). OpenRouterProvider and a local provider can be added later by
 * implementing LLMProvider and wiring them into getProvider().
 *
 * NON-BREAKING:
 *   - Existing callZai() calls keep working unchanged.
 *   - ZaiProvider.call() simply delegates to callZai() with matching opts.
 *   - callLLM() is the drop-in replacement for new code:
 *       // old:  const text = await callZai(prompt, { maxTokens: 4096 });
 *       // new:  const text = await callLLM(prompt, { maxTokens: 4096 });
 *
 * Env:
 *   LLM_PROVIDER — 'zai' (default) | 'openrouter' | 'local' (later).
 *   ZAI_API_KEY  — required for the ZaiProvider to be considered configured.
 *
 * No external dependencies.
 */

import { callZai } from "./zai-direct";

/** Options common to every provider. Mirrors the useful subset of ZaiCallOptions. */
export interface CallOpts {
  /** Max output tokens. Passed through to the provider's default when omitted. */
  maxTokens?: number;
  /** Sampling temperature. */
  temperature?: number;
  /** Enable the provider's thinking/reasoning budget, when supported. */
  thinking?: boolean;
  /** Per-request timeout in ms. */
  timeoutMs?: number;
}

/** A pluggable LLM provider. Implementations must be self-contained. */
export interface LLMProvider {
  /** Stable identifier, e.g. 'zai', 'openrouter', 'local'. */
  id: string;
  /** Run a prompt and return the assistant text. */
  call(prompt: string, opts?: CallOpts): Promise<string>;
  /** Whether the provider has the credentials/config it needs at call time. */
  configured: boolean;
}

/**
 * ZaiProvider — wraps the canonical callZai() (./zai-direct), the path that has
 * been proven 3/3 on ~27KB design prompts. call() is a pure delegation: it maps
 * CallOpts onto ZaiCallOptions 1:1 (the field names already match).
 */
class ZaiProvider implements LLMProvider {
  readonly id = "zai";

  configured: boolean = !!process.env.ZAI_API_KEY;

  async call(prompt: string, opts: CallOpts = {}): Promise<string> {
    // callZai already has its own retries, timeout, and token observability.
    // We only forward the knobs the LLMProvider surface exposes.
    return callZai(prompt, {
      ...(opts.maxTokens !== undefined ? { maxTokens: opts.maxTokens } : {}),
      ...(opts.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
      ...(opts.thinking !== undefined ? { thinking: opts.thinking } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
  }
}

/**
 * Resolve the active provider from process.env.LLM_PROVIDER.
 *
 * Currently only 'zai' is implemented → returns a shared ZaiProvider instance.
 * Unknown / unset values fall back to 'zai'. Future providers ('openrouter',
 * 'local') plug in here without touching call sites.
 */
export function getProvider(): LLMProvider {
  const name = (process.env.LLM_PROVIDER || "zai").toLowerCase();

  switch (name) {
    case "zai":
    case "":
    default:
      return zaiProvider;
    // case "openrouter":
    //   return openRouterProvider;  // F2
    // case "local":
    //   return localProvider;       // F3
  }
}

/**
 * Convenience: run a prompt against the active provider.
 *
 * Drop-in replacement for callZai in new code. Existing callZai calls remain
 * valid (ZaiProvider wraps them).
 */
export function callLLM(prompt: string, opts?: CallOpts): Promise<string> {
  return getProvider().call(prompt, opts);
}

/** True when the active provider is ready (has its credentials/config). */
export function isConfigured(): boolean {
  return getProvider().configured;
}

// Single shared instance — providers are stateless beyond env reads.
const zaiProvider = new ZaiProvider();
