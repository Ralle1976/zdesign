/**
 * zai-direct.ts — Canonical Z.ai direct client (FUNDED Anthropic endpoint).
 *
 * DECISIVE ARCHITECTURE (proven 3/3 on ~27KB / ~110s design prompts):
 * Z.Design calls the funded Z.ai ANTHROPIC endpoint DIRECTLY — no Fusion
 * middleman (Fusion's panel-overhead + panel-timeouts were the flakiness).
 *
 *   POST {ZAI_BASE_URL}/v1/messages
 *     headers: x-api-key: $ZAI_API_KEY
 *              Authorization: Bearer $ZAI_API_KEY
 *              anthropic-version: 2023-06-01
 *              Content-Type: application/json
 *     body:   { model, max_tokens, temperature,
 *               thinking: { type: 'enabled' | 'disabled' },
 *               messages: [{ role: 'user', content: prompt }] }
 *     resp:   { content: [ { type: 'text', text }, ... ] }
 *
 * Reliability:
 *   - Retries up to 3× on non-2xx / empty content / network / timeout, with
 *     backoff 2s, 4s, 8s (+ jitter).
 *   - Per-call timeout via AbortController (default 180s — heavy prompts run
 *     ~110s; 60s was too tight for the design agent).
 *   - thinking defaults DISABLED (clean output; no reasoning tokens leaked).
 *
 * No external dependencies. Works in Node (Next server) and Bun.
 *
 * Env (resolved at call time; .env.local is the source of truth):
 *
 * NOTE: a single dependency on the app logger is imported lazily to avoid a
 * circular import with @/lib/db at module-load time.
 *   ZAI_API_KEY  — required (funded plan key, same as fusion-impl/.env).
 *                  Falls back to /home/tango/fusion-impl/.env for local smoke tests.
 *   ZAI_BASE_URL — defaults to https://api.z.ai/api/anthropic
 *   ZAI_MODEL    — default text model, defaults to glm-5.2
 */

/** Anthropic content-block union (for multimodal/vision calls). */
export type ZaiContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type ZaiCallOptions = {
  /** Override the default text model. */
  model?: string;
  /** Max output tokens. Default 8000. */
  maxTokens?: number;
  /** Sampling temperature. Default 0.4. */
  temperature?: number;
  /** Enable thinking budget. Default: DISABLED (clean output). */
  thinking?: boolean;
  /** Per-request timeout in ms. Default 180000. */
  timeoutMs?: number;
  /** Max attempts (including first). Default 3. */
  maxRetries?: number;
  /**
   * Force a structured output mode. When set to "json_object", the request
   * body carries `response_format: { type: "json_object" }` (Z.ai paas/v4
   * supports this on the Anthropic-shaped endpoint), which GUARANTEES the
   * model emits valid JSON. Use for any call that expects a JSON payload
   * (e.g. panelist critiques → {score, refinements, summary}) to eliminate
   * parse failures at the source instead of relying on jsonrepair.
   */
  responseFormat?: "json_object";
};

export const ZAI_MODELS = {
  text: "glm-5.2",
  textFast: "glm-4.7",
  /** Multimodal vision model on this plan. */
  vision: "glm-5v-turbo",
  visionAlt: "glm-4.6v",
} as const;

const DEFAULT_BASE = "https://api.z.ai/api/anthropic";
const DEFAULT_MODEL = "glm-5.2";
const DEFAULT_VISION_MODEL = "glm-5v-turbo";
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 3;
const ANTHROPIC_VERSION = "2023-06-01";
const FUSION_ENV_FALLBACK = process.env.FUSION_ENV_FALLBACK || "";

let fusionEnvLoaded = false;
async function loadFusionEnvFallback(): Promise<void> {
  if (fusionEnvLoaded) return;
  fusionEnvLoaded = true;
  try {
    const fs = await import("node:fs");
    const txt = fs.readFileSync(FUSION_ENV_FALLBACK, "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  } catch {
    /* best-effort; fine in prod where .env.local has the key */
  }
}

async function getApiKey(): Promise<string> {
  if (!process.env.ZAI_API_KEY) await loadFusionEnvFallback();
  const key = process.env.ZAI_API_KEY;
  if (!key) {
    throw new Error(
      "zai-direct: ZAI_API_KEY is not set. Add it to .env.local (ZAI_API_KEY, ZAI_BASE_URL, ZAI_MODEL)."
    );
  }
  return key;
}

function getBase(): string {
  return (process.env.ZAI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Pull the assistant text out of an Anthropic-shaped response.
 * content is an array of blocks; we join the .text of every text block.
 */
function extractText(json: any): string {
  const content = json?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block: any) =>
        block && typeof block === "object" && block.type === "text"
          ? String(block.text ?? "")
          : ""
      )
      .join("");
  }
  // Defensive fallbacks for non-standard shapes.
  const fb =
    json?.completion ??
    json?.output?.text ??
    json?.choices?.[0]?.message?.content ??
    "";
  return typeof fb === "string" ? fb : "";
}

async function doRequest(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  apiKey: string
): Promise<{ http: number; json: any; raw: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        Authorization: `Bearer ${apiKey}`,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let json: any = null;
    try {
      json = JSON.parse(raw);
    } catch {
      /* keep raw */
    }
    return { http: res.status, json, raw };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call the funded Z.ai Anthropic endpoint directly (no Fusion).
 *
 * Signature is a drop-in for callFusionText: `(prompt, opts?) => Promise<string>`.
 *
 * Retries on: network/abort errors, non-2xx HTTP (incl. 429/5xx), and 2xx with
 * empty content. Throws a clear Error only after all attempts are exhausted.
 *
 * @returns the assistant message text (concatenation of text blocks).
 */
export async function callZai(
  prompt: string | ZaiContentBlock[],
  opts: ZaiCallOptions = {}
): Promise<string> {
  const apiKey = await getApiKey();
  const base = getBase();
  const model = opts.model || process.env.ZAI_MODEL || DEFAULT_MODEL;
  const maxRetries = Math.max(1, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    thinking: { type: opts.thinking === true ? "enabled" : "disabled" },
    messages: [{ role: "user", content: prompt }], // string OR content-block[] — both Anthropic-valid
  };

  // N3 JSON-mode: when the caller asks for json_object, ask the Z.ai paas/v4
  // endpoint to guarantee valid JSON output (no markdown fences, no preamble).
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const url = `${base}/v1/messages`;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { http, json, raw } = await doRequest(
        url,
        body,
        timeoutMs,
        apiKey
      );

      const apiErr =
        (json?.error && (json.error.message || json.error.type)) || "";
      const transient =
        http >= 500 ||
        http === 429 ||
        (http === 422 && /timeout|upstream|busy|overload/i.test(String(apiErr)));

      const content =
        http >= 200 && http < 300 ? extractText(json) : "";

      if (http >= 200 && http < 300 && content.trim().length > 0) {
        // Observability (F0): record token usage from the Z.ai response.
        // Z.ai's Anthropic-shaped response includes:
        //   usage: { input_tokens, output_tokens, cache_read_input_tokens? }
        // Best-effort + never throws. Lazy-imported to keep this module
        // dependency-free at load time (logger pulls in @/lib/db).
        try {
          const usage = json?.usage ?? {};
          const cached =
            usage.cache_read_input_tokens ??
            usage.cached_tokens ??
            usage.cache_creation_input_tokens ??
            0;
          // Fire-and-forget; don't await — must not add latency to the hot path.
          import("@/lib/logger")
            .then(({ logTokens }) =>
              logTokens(
                model,
                "callZai",
                Number(usage.input_tokens ?? 0),
                Number(usage.output_tokens ?? 0),
                Number(cached ?? 0)
              )
            )
            .catch(() => {});
        } catch {
          /* never let observability break the call */
        }
        return content;
      }

      lastErr = new Error(
        `zai-direct HTTP ${http}: ${(
          apiErr ||
          raw ||
          "empty content"
        ).slice(0, 200)}`
      );

      const isLast = attempt === maxRetries;
      if (isLast || !transient) {
        // Non-retryable (400 bad request, 401 auth, etc.) → fail fast.
        throw lastErr;
      }
      // Backoff: 2s, 4s, 8s ... + up to 0.5s jitter.
      const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      await sleep(backoff);
    } catch (e) {
      lastErr = e;
      // Abort/timeout/network → retry unless this was the last attempt.
      const isLast = attempt === maxRetries;
      if (isLast) {
        throw new Error(
          `zai-direct: all ${maxRetries} attempts failed: ${
            (e as Error)?.message || String(e)
          }`
        );
      }
      const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      await sleep(backoff);
    }
  }

  throw new Error(
    `zai-direct: exhausted retries: ${
      (lastErr as Error)?.message || "unknown"
    }`
  );
}

/**
 * Vision call: sends a text prompt plus a base64 image to the vision model.
 * Secondary path (the design agent is text-only).
 *
 * @param textPrompt  e.g. "What color dominates this image?"
 * @param imageBase64 raw base64 (no data: prefix). The data URI is built here.
 * @param opts        model defaults to glm-5v-turbo; thinking disabled by default.
 */
export async function callZaiVision(
  textPrompt: string,
  imageBase64: string,
  opts: ZaiCallOptions = {}
): Promise<string> {
  const cleanB64 = imageBase64.replace(
    /^data:image\/[a-zA-Z]+;base64,/,
    ""
  );
  return callZai(
    [
      { type: "text", text: textPrompt },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: cleanB64,
        },
      },
    ],
    {
      model: opts.model || DEFAULT_VISION_MODEL,
      thinking: false,
      ...opts,
    }
  );
}
