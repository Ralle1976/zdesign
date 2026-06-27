/**
 * gemini-direct.ts — native Google Gemini client (BYOK: GOOGLEAPIKEY).
 *
 * The CREAM pipeline's GENERATE model (chosen 2026-06-27): GLM-5.2 caps ~6-7;
 * Gemini 2.5 Pro is the lever to actual cream. Z.Design keeps its workflow
 * (skills/templates/loop) and routes the heavy generation through Gemini.
 *
 *   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *     header: x-goog-api-key: $GOOGLEAPIKEY
 *     body:   { contents: [{role:"user", parts:[{text}|{inline_data}]}],
 *               generationConfig: { maxOutputTokens, temperature } }
 *     resp:   { candidates: [{ content: { parts: [{ text }] } }] }
 *
 * Drop-in: callGemini(prompt, opts) => Promise<string>.
 * Vision:  callGeminiVision(prompt, imageBase64, opts) — Gemini critiques what
 *          it SEES (replaces the too-lenient GLM-4.6v as the cream judge).
 *
 * Env: GOOGLEAPIKEY (read at call time). No external deps. Never logs the key.
 */
const DEFAULT_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-pro';
const DEFAULT_MAX_TOKENS = 12000;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_TIMEOUT_MS = 300_000;
const DEFAULT_MAX_RETRIES = 3;

export type GeminiCallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
};

function getKey(): string {
  const key = process.env.GOOGLEAPIKEY || process.env.GEMINI_API_KEY;
  if (!key) throw new Error('gemini-direct: GOOGLEAPIKEY not set (add to .env.local).');
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function extractText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (Array.isArray(parts)) return parts.map((p: any) => String(p?.text ?? '')).join('');
  return String(json?.candidates?.[0]?.content ?? json?.text ?? '');
}

async function doRequest(url: string, body: Record<string, unknown>, timeoutMs: number): Promise<{ http: number; json: any; raw: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': getKey() },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let json: any = null;
    try { json = JSON.parse(raw); } catch { /* keep raw */ }
    return { http: res.status, json, raw };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Call Gemini (text). Retries on network/5xx/429/empty. Throws after exhaustion.
 */
export async function callGemini(prompt: string, opts: GeminiCallOptions = {}): Promise<string> {
  const model = opts.model || DEFAULT_MODEL;
  const maxRetries = Math.max(1, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${DEFAULT_BASE}/models/${model}:generateContent`;
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    },
  };
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { http, json, raw } = await doRequest(url, body, timeoutMs);
      const apiErr = json?.error?.message || '';
      const transient = http >= 500 || http === 429 || (http === 400 && /overload|quota|busy/i.test(String(apiErr)));
      const text = http >= 200 && http < 300 ? extractText(json) : '';
      if (http >= 200 && http < 300 && text.trim().length > 0) return text;
      lastErr = new Error(`gemini HTTP ${http}: ${(apiErr || raw || 'empty').slice(0, 200)}`);
      const isLast = attempt === maxRetries;
      if (isLast || !transient) throw lastErr;
      await sleep(2000 * Math.pow(2, attempt - 1));
    } catch (e) {
      lastErr = e;
      const isLast = attempt === maxRetries;
      if (isLast) throw new Error(`gemini-direct: all ${maxRetries} attempts failed: ${(e as Error)?.message || String(e)}`);
      await sleep(2000 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error(`gemini-direct: exhausted retries: ${(lastErr as Error)?.message || 'unknown'}`);
}

/**
 * Vision call: text prompt + a base64 image (no data: prefix). Used as the
 * (stricter) cream judge — Gemini sees the rendered design. Alias for the full
 * multimodal call (Gemini wants parts[] with inline_data).
 */
export function callGeminiVision(textPrompt: string, imageBase64: string, opts: GeminiCallOptions = {}): Promise<string> {
  return callGeminiMultimodal(textPrompt, imageBase64, opts);
}

// NOTE: callGeminiVision above is a thin wrapper kept for API symmetry; the
// full multimodal call is exposed below (Gemini wants parts[] with inline_data).
export async function callGeminiMultimodal(
  textPrompt: string,
  imageBase64: string,
  opts: GeminiCallOptions = {},
): Promise<string> {
  const model = opts.model || DEFAULT_MODEL;
  const maxRetries = Math.max(1, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
  const timeoutMs = opts.timeoutMs ?? 120_000;
  const url = `${DEFAULT_BASE}/models/${model}:generateContent`;
  const clean = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
  const body: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: textPrompt }, { inline_data: { mime_type: 'image/png', data: clean } }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0.3,
    },
  };
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { http, json, raw } = await doRequest(url, body, timeoutMs);
      const apiErr = json?.error?.message || '';
      const transient = http >= 500 || http === 429;
      const text = http >= 200 && http < 300 ? extractText(json) : '';
      if (http >= 200 && http < 300 && text.trim().length > 0) return text;
      lastErr = new Error(`gemini-vision HTTP ${http}: ${(apiErr || raw || 'empty').slice(0, 200)}`);
      const isLast = attempt === maxRetries;
      if (isLast || !transient) throw lastErr;
      await sleep(2000 * Math.pow(2, attempt - 1));
    } catch (e) {
      lastErr = e;
      const isLast = attempt === maxRetries;
      if (isLast) throw new Error(`gemini-vision: all ${maxRetries} attempts failed: ${(e as Error)?.message || String(e)}`);
      await sleep(2000 * Math.pow(2, attempt - 1));
    }
  }
  throw new Error(`gemini-vision: exhausted retries: ${(lastErr as Error)?.message || 'unknown'}`);
}
