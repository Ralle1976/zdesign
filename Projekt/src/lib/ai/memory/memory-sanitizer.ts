/**
 * memory-sanitizer.ts — P2.2 trust-tiering + prompt-injection guard for the
 * memory layer. Retrieved memories can carry content that originated from user
 * text (episode rootCause/feedback), which is a stored-prompt-injection vector:
 * a malicious brief could plant "ignore previous instructions…" into an episode
 * that later gets injected into an agent's context.
 *
 * Two defenses (deterministic; a full LlamaGuard classifier is the deferred
 * model-based upgrade):
 *   1. sanitizePayload() — regex/heuristic detection of instruction-shaped
 *      payloads; offending spans are redacted and the item is flagged.
 *   2. wrapUntrusted() — low-trust content is emitted inside an <untrusted>
 *      envelope the consuming system prompt treats as DATA, not instructions.
 *
 * Pure, synchronous, no deps.
 */

/** Trust tier: higher = more trusted. Episode/learned content is tier 1
 *  (system-derived but may echo user text); user-brief is tier 0. */
export const TRUST = {
  system: 2, // built-in / deterministic
  learned: 1, // approved recipe (model-distilled, reviewed threshold)
  episode: 1, // a recorded run (model output, may echo user text)
  user: 0, // raw user/scraped content (highest injection risk)
} as const;
export type TrustTier = (typeof TRUST)[keyof typeof TRUST];

/** Instruction-injection signatures. Intentionally broad → favor redaction. */
const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override)\b[^.]{0,30}\b(previous|prior|above|all|system|prompt|instructions?)\b/gi,
  /^\s*(system|user|assistant|tool)\s*:/gim,
  /<\/?(system|prompt|instructions?|tool|role)\b/gi,
  /\[\/?INST\]/gi,
  /\bnew (system )?instructions?\b/gi,
  /\brespond (only|just|solely)\b/gi,
  /\byou are (now|a) /gi,
  /```/g,
];

export interface SanitizeResult {
  clean: string;
  hadInjection: boolean;
  /** Number of spans redacted. */
  flags: number;
}

/**
 * Redact instruction-shaped spans from a payload. Never throws. Flags the item
 * so callers can downgrade trust or drop it entirely.
 */
export function sanitizePayload(text: string): SanitizeResult {
  const out: SanitizeResult = { clean: text ?? '', hadInjection: false, flags: 0 };
  if (!text) return out;
  try {
    let flags = 0;
    out.clean = text;
    for (const re of INJECTION_PATTERNS) {
      out.clean = out.clean.replace(re, () => {
        flags++;
        return '[redacted-injection]';
      });
    }
    // strip control chars (incl. embedded form-feed/null) + collapse redaction runs
    out.clean = out.clean.replace(/[\x00-\x1F\x7F]/g, '').replace(/(\[redacted-injection\]\s*){2,}/g, '[redacted-injection] ');
    out.flags = flags;
    out.hadInjection = flags > 0;
    return out;
  } catch {
    return out;
  }
}

/** Wrap low-trust content in an envelope the consuming prompt treats as data. */
export function wrapUntrusted(text: string, source: string): string {
  return `<untrusted source="${source}">${text}</untrusted>`;
}

/** Quick boolean: does this text look instruction-shaped? */
export function detectInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}
