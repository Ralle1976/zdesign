/**
 * secret-redactor.ts — the memory's SECRET GUARD / cleaner (P2.5).
 *
 * The brain learns from episode content (prompts, rootCauses, feedback) that
 * ORIGINATED FROM USER INPUT. A user (or a scraped doc) can put an API key,
 * token, or private key into a design brief → without a guard that secret lands
 * in DesignHistory / DesignLesson / feedback.jsonl → gets recalled → LEAKS.
 *
 * This module is the ingest-door guard: redactSecrets() detects + scrubs the
 * common secret shapes BEFORE they are persisted, so the memory is safe to ship
 * publicly. Applied in recordDesign (primary) AND recall output (defense-in-
 * depth). Never throws; never alters non-secret text.
 *
 * This is the non-negotiable gate for "Z.Design + learned memory, public".
 */
export interface RedactResult {
  clean: string;
  found: string[]; // secret types detected, e.g. ['api-key','private-key']
}

/** High-signal secret shapes. Order matters: longest/most-specific first. */
const SECRET_PATTERNS: { type: string; re: RegExp }[] = [
  // PEM private key blocks (multi-line) — grab the whole block
  { type: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g },
  // Connection strings with embedded credentials: scheme://user:pass@host
  { type: 'credentials-in-url', re: /([a-z][a-z0-9+.-]*):\/\/[^\s:/@@"']+:[^\s:/@@"']+@[^\s/]+/gi },
  // Generic key=value assignments for sensitive names (api_key=…, password=…, secret=…, token=…)
  { type: 'key-assignment', re: /\b(api[_-]?key|secret|password|passwd|token|access[_-]?key|client[_-]?secret|private[_-]?key|bearer)\b\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{8,}["']?/gi },
  // Known-provider token prefixes
  { type: 'openai-key', re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { type: 'github-token', re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { type: 'aws-key', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'google-key', re: /\bAIza[0-9A-Za-z_\-]{35}\b/g },
  { type: 'gitlab-token', re: /\bglpat-[A-Za-z0-9_\-]{20,}\b/g },
  { type: 'slack-token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'stripe-key', re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}\b/g },
  { type: 'jwt', re: /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g },
  // Bearer tokens
  { type: 'bearer', re: /\bBearer\s+[A-Za-z0-9_\-./+=]{16,}/g },
];

/**
 * Scrub secret-shaped spans from text. Offending spans → '[REDACTED:<type>]'.
 * Never throws; idempotent; leaves non-secret text byte-identical.
 */
export function redactSecrets(text: string): RedactResult {
  const out: RedactResult = { clean: text ?? '', found: [] };
  if (!text) return out;
  try {
    for (const { type, re } of SECRET_PATTERNS) {
      let hit = false;
      out.clean = out.clean.replace(re, () => {
        hit = true;
        return `[REDACTED:${type}]`;
      });
      if (hit && !out.found.includes(type)) out.found.push(type);
    }
    return out;
  } catch {
    return out;
  }
}

/** Quick boolean: does this text contain a secret-shaped span? */
export function containsSecret(text: string): boolean {
  if (!text) return false;
  return SECRET_PATTERNS.some(({ re }) => re.test(text));
}
