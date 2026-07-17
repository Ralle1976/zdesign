/**
 * xai-direct.ts — xAI Grok direct client (OpenAI-compatible endpoint).
 *
 *   POST https://api.x.ai/v1/chat/completions
 *     headers: Authorization: Bearer $XAI_API_KEY
 *     body:   { model, max_tokens, temperature, messages: [{ role, content }] }
 *     resp:   { choices: [{ message: { content } }] }
 *
 * Env (resolved at call time; .env.local is the source of truth):
 *   XAI_API_KEY  — required (from console.x.ai)
 *   XAI_BASE_URL — defaults to https://api.x.ai/v1
 *   XAI_MODEL    — default text model, defaults to grok-4.5
 */

import { readProviderKey, getProviderById } from './provider-config';

export type XaiCallOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  maxRetries?: number;
  responseFormat?: 'json_object';
};

export const XAI_MODELS = {
  text: 'grok-4.5',
  build: 'grok-build-0.1',
  fast: 'grok-4.3',
} as const;

const DEFAULT_BASE = 'https://api.x.ai/v1';
const DEFAULT_MODEL = 'grok-4.5';
const DEFAULT_MAX_TOKENS = 8000;
const DEFAULT_TEMPERATURE = 0.4;
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 3;

function getApiKey(): string {
  const provider = getProviderById('xai');
  const key = provider ? readProviderKey(provider) : process.env.XAI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      'xai-direct: XAI_API_KEY is not set. Add it to .env.local or Provider Settings.',
    );
  }
  return key;
}

function getBase(): string {
  return (process.env.XAI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, '');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function extractText(json: unknown): string {
  const j = json as Record<string, unknown>;
  const choices = j?.choices as Array<{ message?: { content?: string } }> | undefined;
  if (Array.isArray(choices) && choices[0]?.message?.content) {
    return String(choices[0].message.content);
  }
  const output = j?.output_text ?? j?.output;
  if (typeof output === 'string') return output;
  return '';
}

async function doRequest(
  url: string,
  body: Record<string, unknown>,
  timeoutMs: number,
  apiKey: string,
): Promise<{ http: number; json: unknown; raw: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let json: unknown = null;
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
 * Call the xAI Grok API directly. Drop-in for callZai: (prompt, opts?) => Promise<string>.
 */
export async function callXai(prompt: string, opts: XaiCallOptions = {}): Promise<string> {
  const apiKey = getApiKey();
  const base = getBase();
  const model = opts.model || process.env.XAI_MODEL || DEFAULT_MODEL;
  const maxRetries = Math.max(1, opts.maxRetries ?? DEFAULT_MAX_RETRIES);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
    temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
    messages: [{ role: 'user', content: prompt }],
  };

  if (opts.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }

  const url = `${base}/chat/completions`;
  let lastErr: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { http, json, raw } = await doRequest(url, body, timeoutMs, apiKey);
      const errObj = (json as { error?: { message?: string; type?: string } })?.error;
      const apiErr = errObj?.message || errObj?.type || '';
      const transient =
        http >= 500 ||
        http === 429 ||
        (http === 422 && /timeout|upstream|busy|overload/i.test(String(apiErr)));

      const content = http >= 200 && http < 300 ? extractText(json) : '';

      if (http >= 200 && http < 300 && content.trim().length > 0) {
        try {
          const usage = (json as { usage?: Record<string, number> })?.usage ?? {};
          import('@/lib/logger')
            .then(({ logTokens }) =>
              logTokens(
                model,
                'callXai',
                Number(usage.prompt_tokens ?? usage.input_tokens ?? 0),
                Number(usage.completion_tokens ?? usage.output_tokens ?? 0),
                0,
              ),
            )
            .catch(() => {});
        } catch {
          /* observability must not break the call */
        }
        return content;
      }

      lastErr = new Error(
        `xai-direct HTTP ${http}: ${(apiErr || raw || 'empty content').slice(0, 200)}`,
      );

      const isLast = attempt === maxRetries;
      if (isLast || !transient) throw lastErr;

      const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      await sleep(backoff);
    } catch (e) {
      lastErr = e;
      const isLast = attempt === maxRetries;
      if (isLast) {
        throw new Error(
          `xai-direct: all ${maxRetries} attempts failed: ${(e as Error)?.message || String(e)}`,
        );
      }
      const backoff = 2000 * Math.pow(2, attempt - 1) + Math.random() * 500;
      await sleep(backoff);
    }
  }

  throw new Error(
    `xai-direct: exhausted retries: ${(lastErr as Error)?.message || 'unknown'}`,
  );
}