/**
 * health-check.ts — Lightweight provider connectivity checks.
 *
 * testProvider(providerId) is the single entry point used by the "Test" buttons
 * in the provider management UI. It performs the smallest possible round-trip
 * against the provider's real API and reports {ok, latencyMs, message}.
 *
 * Designed to NEVER throw — failures are returned as {ok:false} so the route
 * handler can pass them straight through to the client.
 */

import { getProviderById, readProviderKey, type ProviderEntry } from './provider-config';

export interface TestResult {
  ok: boolean;
  latencyMs: number;
  message: string;
}

const TEST_TIMEOUT_MS = 12_000;

/** Fetch wrapper with a hard timeout — rejects with 'Timeout' after TEST_TIMEOUT_MS. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Run a health check against a provider. Returns ok:false for unknown providers,
 * missing keys, timeouts, and non-2xx responses — never throws.
 */
export async function testProvider(providerId: string): Promise<TestResult> {
  const provider = getProviderById(providerId);
  if (!provider) {
    return { ok: false, latencyMs: 0, message: `Unknown provider: ${providerId}` };
  }

  const key = readProviderKey(provider);
  if (provider.envKey && !key) {
    return {
      ok: false,
      latencyMs: 0,
      message: `No API key set (${provider.envKey}).`,
    };
  }

  const start = Date.now();
  try {
    const ok = await pingProvider(provider, key);
    const latencyMs = Date.now() - start;
    return ok
      ? { ok: true, latencyMs, message: `${provider.name} reachable.` }
      : {
          ok: false,
          latencyMs,
          message: `${provider.name} responded with an error.`,
        };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const msg = e instanceof Error ? e.message : String(e);
    const isTimeout =
      e instanceof Error && (e.name === 'AbortError' || msg === 'Timeout');
    return {
      ok: false,
      latencyMs,
      message: isTimeout
        ? `${provider.name} timed out after ${TEST_TIMEOUT_MS}ms.`
        : `${provider.name} unreachable: ${msg.slice(0, 160)}`,
    };
  }
}

/** Provider-specific ping. Returns true on a healthy round-trip. */
async function pingProvider(
  provider: ProviderEntry,
  key: string | undefined,
): Promise<boolean> {
  switch (provider.id) {
    case 'zai':
      return pingZai(key);
    case 'openrouter':
      return pingOpenRouter(key);
    case 'minimax':
      return pingMinimax(key);
    case 'higgsfield':
      // No public ping endpoint / not yet wired in image-router — treat key
      // presence as configured-but-unverified.
      return !!key;
    case 'replicate':
      return pingReplicate(key);
    default:
      return false;
  }
}

async function pingZai(key: string | undefined): Promise<boolean> {
  const baseUrl = (process.env.ZAI_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return false;
  // Anthropic messages endpoint with a 1-token smoke prompt.
  const res = await fetchWithTimeout(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key || '',
      authorization: `Bearer ${key || ''}`,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ZAI_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'OK' }],
    }),
  });
  return res.ok;
}

async function pingOpenRouter(key: string | undefined): Promise<boolean> {
  // OpenRouter exposes a key-validation endpoint.
  const res = await fetchWithTimeout('https://openrouter.ai/api/v1/key', {
    method: 'GET',
    headers: { authorization: `Bearer ${key || ''}` },
  });
  return res.ok;
}

async function pingMinimax(key: string | undefined): Promise<boolean> {
  // Cheapest probe: a 1-token chat completion against the text model.
  const baseUrl = (process.env.MINIMAX_BASE_URL || 'https://api.minimax.chat/v1').replace(/\/$/, '');
  const res = await fetchWithTimeout(`${baseUrl}/text/chatcompletion_v2`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${key || ''}`,
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      tokens_to_generate: 1,
      messages: [{ role: 'user', content: 'OK' }],
    }),
  });
  return res.ok;
}

async function pingReplicate(key: string | undefined): Promise<boolean> {
  // Replicate's account endpoint validates the token.
  const res = await fetchWithTimeout('https://api.replicate.com/v1/account', {
    method: 'GET',
    headers: { authorization: `Token ${key || ''}` },
  });
  return res.ok;
}
