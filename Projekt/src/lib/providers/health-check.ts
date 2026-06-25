// Z.Design — Provider Health Check
//
// Sends a tiny probe to a provider and reports reachability + latency. Used by
// the settings UI's "Test connection" button. Each test is deliberately cheap:
//   - text:  a 1-token "say OK" prompt
//   - image: a 1-image generation at minimal size
//   - MCP:   a connection/headers probe
//
// NEVER throws — every code path returns `{ ok, message }`. Failures (missing
// key, non-2xx, timeout, network) are captured into the result.
//
// The proven direct clients (callZai, image-minimax, image-replicate) are used
// where they exist; for providers without a dedicated client we send a minimal
// raw HTTP probe. No external dependencies.

import { getProviderById, type ProviderConfig } from "./registry";

/** Result of a provider probe. */
export interface ProviderTestResult {
  /** True iff the provider responded successfully. */
  ok: boolean;
  /** Round-trip time in ms (only set when ok). */
  latencyMs?: number;
  /** Human-readable status message. */
  message: string;
}

/** Default per-probe timeout (kept short — this is a connectivity ping). */
const DEFAULT_TIMEOUT_MS = 20_000;

/** The trivial probe prompt sent to text providers. */
const TEXT_PROBE_PROMPT = "Reply with exactly: OK";

function fail(message: string): ProviderTestResult {
  return { ok: false, message };
}

function ok(latencyMs: number, extra?: string): ProviderTestResult {
  return {
    ok: true,
    latencyMs,
    message: extra ? `Connected (${latencyMs} ms) — ${extra}` : `Connected (${latencyMs} ms)`,
  };
}

function elapsed(from: number): number {
  return Math.round(performance.now() - from);
}

/**
 * Probe a provider by id. Routes to the right test based on provider type and
 * id. Never throws.
 */
export async function testProvider(
  providerId: string,
): Promise<ProviderTestResult> {
  const provider = getProviderById(providerId);
  if (!provider) {
    return fail(`Unknown provider: ${providerId}`);
  }

  // Gate on credentials first — cheap and avoids a guaranteed-failing network call.
  if (provider.apiKeyEnv && !process.env[provider.apiKeyEnv]) {
    return fail(`${provider.apiKeyEnv} not set`);
  }

  try {
    switch (provider.id) {
      case "zai":
        return await testZaiText();
      case "minimax-text":
        return await testMinimaxText();
      case "openrouter":
        return await testOpenRouter();
      case "minimax-image":
        return await testMinimaxImage();
      case "replicate":
        return await testReplicateImage();
      case "higgsfield":
        return await testHiggsfieldMcp(provider);
      case "zai-image":
        return await testZaiImage();
      case "zai-asr":
        return await testZaiAsr(provider);
      default:
        return fail(`No health check implemented for provider: ${providerId}`);
    }
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

// ============ Text probes ============

/**
 * Z.ai text probe — uses the canonical callZai() (./zai-direct) which already
 * has retries + timeout. A 1-token-max "say OK" call with a tight timeout.
 */
async function testZaiText(): Promise<ProviderTestResult> {
  const { callZai } = await import("../ai/zai-direct");
  const start = performance.now();
  const text = await callZai(TEXT_PROBE_PROMPT, {
    maxTokens: 16,
    temperature: 0,
    thinking: false,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxRetries: 1,
  });
  const ms = elapsed(start);
  // callZai throws on empty; if we got here, content is non-empty.
  return ok(ms, `model replied (${text.slice(0, 24)}…)`);
}

/**
 * MiniMax text probe — raw POST to the Anthropic-shaped endpoint. We don't have
 * a dedicated client for minimax-text, so a minimal raw probe.
 */
async function testMinimaxText(): Promise<ProviderTestResult> {
  const key = process.env.MINIMAX_API_KEY!;
  const base = "https://api.minimax.io/anthropic";
  const start = performance.now();
  const res = await fetchWithTimeout(
    `${base}/v1/messages`,
    DEFAULT_TIMEOUT_MS,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        Authorization: `Bearer ${key}`,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "MiniMax-M3",
        max_tokens: 16,
        messages: [{ role: "user", content: TEXT_PROBE_PROMPT }],
      }),
    },
  );
  const ms = elapsed(start);
  if (res.status >= 200 && res.status < 300) return ok(ms);
  const errBody = await safeReadText(res);
  return fail(`MiniMax text HTTP ${res.status}: ${errBody.slice(0, 120)}`);
}

/**
 * OpenRouter probe — GET /models with the bearer token. Cheapest authenticated
 * call (no tokens consumed).
 */
async function testOpenRouter(): Promise<ProviderTestResult> {
  const key = process.env.OPENROUTER_API_KEY!;
  const start = performance.now();
  const res = await fetchWithTimeout(
    "https://openrouter.ai/api/v1/models",
    DEFAULT_TIMEOUT_MS,
    { headers: { Authorization: `Bearer ${key}` } },
  );
  const ms = elapsed(start);
  if (res.status >= 200 && res.status < 300) return ok(ms);
  const errBody = await safeReadText(res);
  return fail(`OpenRouter HTTP ${res.status}: ${errBody.slice(0, 120)}`);
}

// ============ Image probes ============

/**
 * MiniMax image probe — uses generateImageMinimax() (./image-minimax), the
 * proven image-01 client. One tiny image, 1:1 aspect.
 */
async function testMinimaxImage(): Promise<ProviderTestResult> {
  const { generateImageMinimax } = await import("../ai/image-minimax");
  const start = performance.now();
  const img = await generateImageMinimax("a single red dot on white", {
    aspectRatio: "1:1",
    numImages: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const ms = elapsed(start);
  return ok(ms, `image-01 returned a URL`);
}

/**
 * Replicate FLUX probe — uses the proven generateImage() (./image-replicate).
 * One 256x256 schnell image (cheapest).
 */
async function testReplicateImage(): Promise<ProviderTestResult> {
  const { generateImage } = await import("../ai/image-replicate");
  const start = performance.now();
  await generateImage("a single red dot on white", {
    width: 256,
    height: 256,
    numOutputs: 1,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });
  const ms = elapsed(start);
  return ok(ms, "FLUX Schnell returned a URL");
}

/**
 * Higgsfield MCP probe — verifies the MCP endpoint is reachable and accepts the
 * token (HEAD/GET probe). Full MCP handshake is out of scope for a connectivity
 * ping.
 */
async function testHiggsfieldMcp(provider: ProviderConfig): Promise<ProviderTestResult> {
  const token = process.env.HIGGSFIELD_API_TOKEN!;
  const url = provider.mcpUrl || "https://mcp.higgsfield.ai/mcp";
  const start = performance.now();
  const res = await fetchWithTimeout(url, DEFAULT_TIMEOUT_MS, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const ms = elapsed(start);
  // 200, 405 (method not allowed for GET on a POST-only MCP), or 406 all
  // indicate the endpoint is alive and accepted the token.
  if (
    res.status === 200 ||
    res.status === 405 ||
    res.status === 406 ||
    res.status === 400
  ) {
    return ok(ms, "MCP endpoint reachable");
  }
  if (res.status === 401 || res.status === 403) {
    return fail(`Higgsfield rejected token (HTTP ${res.status})`);
  }
  const errBody = await safeReadText(res);
  return fail(`Higgsfield MCP HTTP ${res.status}: ${errBody.slice(0, 120)}`);
}

/**
 * Z.ai image probe — raw POST to the paas/v4 image endpoint. No dedicated
 * client exists yet, so a minimal probe that just verifies auth + 2xx.
 */
async function testZaiImage(): Promise<ProviderTestResult> {
  const key = process.env.ZAI_API_KEY!;
  const start = performance.now();
  const res = await fetchWithTimeout(
    "https://api.z.ai/api/paas/v4/images/generations",
    DEFAULT_TIMEOUT_MS,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "glm-image",
        prompt: "a single red dot on white",
        n: 1,
      }),
    },
  );
  const ms = elapsed(start);
  if (res.status >= 200 && res.status < 300) return ok(ms);
  // 4xx other than auth often means the model/endpoint shape differs; treat a
  // 401/403 as a real auth failure and everything else as "endpoint alive".
  if (res.status === 401 || res.status === 403) {
    const errBody = await safeReadText(res);
    return fail(`Z.ai image auth failed (HTTP ${res.status}): ${errBody.slice(0, 120)}`);
  }
  return fail(`Z.ai image HTTP ${res.status}`);
}

// ============ Audio probe ============

/**
 * Z.ai ASR probe — the transcriptions endpoint expects multipart audio, which
 * is awkward for a connectivity ping. Instead we send an empty multipart body
 * and treat 400 (missing audio) as "endpoint reachable + auth ok", and 401/403
 * as auth failure. A 2xx is also a pass.
 */
async function testZaiAsr(provider: ProviderConfig): Promise<ProviderTestResult> {
  const key = process.env.ZAI_API_KEY!;
  const url = provider.endpoint || "https://api.z.ai/api/paas/v4/audio/transcriptions";
  const start = performance.now();
  const res = await fetchWithTimeout(url, DEFAULT_TIMEOUT_MS, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
  });
  const ms = elapsed(start);
  if (res.status >= 200 && res.status < 300) return ok(ms);
  if (res.status === 400) return ok(ms, "endpoint reachable (auth ok)");
  if (res.status === 401 || res.status === 403) {
    return fail(`Z.ai ASR auth failed (HTTP ${res.status})`);
  }
  return fail(`Z.ai ASR HTTP ${res.status}`);
}

// ============ fetch helpers ============

/**
 * fetch with an AbortController timeout. Throws on abort/network error so the
 * caller's try/catch (in testProvider) converts it to a failed result.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Read up to 1KB of the response body as text, never throwing. */
async function safeReadText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 1024);
  } catch {
    return "";
  }
}
