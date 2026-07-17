/**
 * call-text-llm.ts — Routes text generation to the user-selected provider.
 *
 * Reads textProviderId + model override from data/provider-config.json and
 * delegates to callZai / callXai / callGemini. Drop-in replacement for
 * direct callZai() in the agentic HTML pipeline.
 */

import {
  readConfig,
  getProviderById,
  readProviderKey,
  type ProviderConfigFile,
} from './provider-config';
import { callZai, type ZaiCallOptions, type ZaiContentBlock } from './zai-direct';
import { callXai } from './xai-direct';
import { callGemini } from './gemini-direct';

export type TextLLMCallOptions = ZaiCallOptions;

let cachedConfig: ProviderConfigFile | null = null;
let cacheTs = 0;
const CACHE_TTL_MS = 5_000;

async function getTextConfig(): Promise<{
  providerId: string;
  model?: string;
}> {
  const now = Date.now();
  if (!cachedConfig || now - cacheTs > CACHE_TTL_MS) {
    cachedConfig = await readConfig();
    cacheTs = now;
  }
  const providerId = cachedConfig.textProviderId || 'zai';
  const model = cachedConfig.overrides?.[providerId]?.model;
  return { providerId, model };
}

/** Bust config cache after provider settings change (optional). */
export function bustTextLLMConfigCache(): void {
  cachedConfig = null;
  cacheTs = 0;
}

function isProviderConfigured(providerId: string): boolean {
  const entry = getProviderById(providerId);
  if (!entry) return false;
  if (!entry.envKey) return true;
  return !!readProviderKey(entry);
}

/**
 * Resolve the active image provider id + model from provider-config.json.
 */
export async function getActiveImageProvider(): Promise<{ id: string; model?: string }> {
  const config = await readConfig();
  const id = config.imageProviderId || 'minimax';
  const model = config.overrides?.[id]?.model;
  return { id, model };
}

type PromptInput = string | ZaiContentBlock[];

/**
 * Call the configured text LLM provider. Falls back to Z.ai when the selected
 * provider is unknown or missing its API key.
 */
export async function callTextLLM(
  prompt: PromptInput,
  opts: TextLLMCallOptions = {},
): Promise<string> {
  const { providerId, model: configModel } = await getTextConfig();
  const model = opts.model || configModel;

  const mergedOpts: TextLLMCallOptions = { ...opts, ...(model ? { model } : {}) };

  if (!isProviderConfigured(providerId)) {
    console.warn(
      `[callTextLLM] ${providerId} not configured — falling back to zai`,
    );
    return callZai(prompt, mergedOpts);
  }

  switch (providerId) {
    case 'xai':
      if (typeof prompt !== 'string') {
        throw new Error('xai-direct: multimodal content blocks not supported yet');
      }
      return callXai(prompt, {
        model: mergedOpts.model,
        maxTokens: mergedOpts.maxTokens,
        temperature: mergedOpts.temperature,
        timeoutMs: mergedOpts.timeoutMs,
        maxRetries: mergedOpts.maxRetries,
        responseFormat: mergedOpts.responseFormat,
      });

    case 'gemini':
      if (typeof prompt !== 'string') {
        throw new Error('gemini-direct: multimodal content blocks not supported yet');
      }
      return callGemini(prompt, {
        model: mergedOpts.model,
        maxTokens: mergedOpts.maxTokens,
        temperature: mergedOpts.temperature,
        timeoutMs: mergedOpts.timeoutMs,
        maxRetries: mergedOpts.maxRetries,
      });

    case 'zai':
    default:
      return callZai(prompt, mergedOpts);
  }
}