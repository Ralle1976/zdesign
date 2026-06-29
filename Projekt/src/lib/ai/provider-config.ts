/**
 * provider-config.ts — File-based provider registry for the agentic HTML mode.
 *
 * The old DB-backed system (src/app/api/providers/route.ts + Prisma aIProvider)
 * belongs to the node-tree Z.ai SDK world. The new agentic HTML design mode needs
 * a lightweight, file-backed selection that writes to data/provider-config.json
 * and reads API keys from process.env (populated from .env.local via the /keys
 * route). This module is the single source of truth for that world.
 *
 * NO Prisma, NO z-ai-web-dev-sdk. Pure fs + env.
 */

import { promises as fs } from 'fs';
import path from 'path';

// ============ Types ============

export type ProviderKind = 'text' | 'image';

export interface ProviderModel {
  id: string;
  name: string;
}

export interface ProviderEntry {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Env var name that holds the API key (e.g. "ZAI_API_KEY"). Empty = no key needed. */
  envKey: string;
  /** Default model id used when the user hasn't pinned one. */
  defaultModel: string;
  models: ProviderModel[];
  /** Optional base URL env var (e.g. ZAI_BASE_URL). */
  envBaseUrl?: string;
}

export interface ProviderStatus extends ProviderEntry {
  /** True when the env var is present and non-empty. */
  configured: boolean;
  /** Masked key (first 4 + last 4) or null when absent. */
  maskedKey: string | null;
  /** The actual base URL from env (if set), for the UI to pre-fill. */
  baseUrl: string | null;
}

export interface ProviderConfigFile {
  textProviderId: string;
  imageProviderId: string;
  /** Provider for Speech-to-Text (can be different from textProviderId — e.g. OpenRouter Whisper). */
  sttProviderId: string;
  /** Per-provider overrides keyed by provider id. */
  overrides: Record<
    string,
    {
      enabled?: boolean;
      model?: string;
      /** MCP server URL for providers reached over MCP (e.g. Higgsfield). */
      mcpUrl?: string;
    }
  >;
}

// ============ Static Registry ============
//
// The canonical list of providers the UI can choose from. Adding a provider
// here automatically surfaces it in GET /api/providers. Keys are read from env
// at request time, so configured-status reflects the current .env.local.

export const PROVIDERS: ProviderEntry[] = [
  {
    id: 'zai',
    name: 'Z.ai (GLM via Anthropic endpoint)',
    kind: 'text',
    envKey: 'ZAI_API_KEY',
    envBaseUrl: 'ZAI_BASE_URL',
    defaultModel: process.env.ZAI_MODEL || 'glm-5.2',
    models: [
      { id: 'glm-5.2', name: 'GLM-5.2 (default, strongest)' },
      { id: 'glm-4.7', name: 'GLM-4.7 (fast)' },
      { id: 'glm-5v-turbo', name: 'GLM-5v-Turbo (vision, NOT on plan)' },
      { id: 'glm-4.6v', name: 'GLM-4.6v (vision)' },
      { id: 'glm-asr-2512', name: 'GLM-ASR (Speech-to-Text)' },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini (BYOK)',
    kind: 'text',
    envKey: 'GOOGLEAPIKEY',
    defaultModel: 'gemini-3.1-pro-preview',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview (strongest)' },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview' },
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash (fast)' },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash Preview' },
      { id: 'gemini-pro-latest', name: 'Gemini Pro (latest)' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (multi-model)',
    kind: 'text',
    envKey: 'OPENROUTER_API_KEY',
    envBaseUrl: 'OPENROUTER_BASE_URL',
    defaultModel: 'openai/whisper-1',
    models: [
      { id: 'openai/whisper-1', name: 'Whisper (Speech-to-Text)' },
      { id: 'deepseek/deepseek-chat-v3', name: 'DeepSeek V3 (free)' },
      { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B (free)' },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (free)' },
      { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B (free)' },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax (Images)',
    kind: 'image',
    envKey: 'MINIMAX_API_KEY',
    defaultModel: 'image-01',
    models: [
      { id: 'image-01', name: 'MiniMax image-01' },
      { id: 'abab6.5s-image', name: 'abab6.5s image' },
    ],
  },
];

// ============ Helpers ============

const CONFIG_PATH = path.join(process.cwd(), 'data', 'provider-config.json');

const DEFAULT_CONFIG: ProviderConfigFile = {
  textProviderId: 'zai',
  imageProviderId: 'minimax',
  sttProviderId: 'openrouter',
  overrides: {},
};

export function getProviderById(id: string): ProviderEntry | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

/** Mask a key as first4 + ... + last4. Returns null for empty/short keys. */
export function maskKey(key: string | undefined): string | null {
  if (!key) return null;
  const trimmed = key.trim();
  if (trimmed.length < 8) return null;
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

/** Read the env value for a provider's key (server-side only). */
export function readProviderKey(provider: ProviderEntry): string | undefined {
  if (!provider.envKey) return undefined;
  return process.env[provider.envKey];
}

/** Build the status view (configured + maskedKey) for a provider entry. */
export function toStatus(provider: ProviderEntry): ProviderStatus {
  const key = readProviderKey(provider);
  const baseUrl = provider.envBaseUrl ? (process.env[provider.envBaseUrl] || null) : null;
  return {
    ...provider,
    configured: !!key,
    maskedKey: maskKey(key),
    baseUrl,
  };
}

// ============ Config File I/O ============

export async function readConfig(): Promise<ProviderConfigFile> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<ProviderConfigFile>;
    // Merge over defaults so missing fields don't crash callers.
    return {
      textProviderId: parsed.textProviderId || DEFAULT_CONFIG.textProviderId,
      imageProviderId: parsed.imageProviderId || DEFAULT_CONFIG.imageProviderId,
      sttProviderId: parsed.sttProviderId || DEFAULT_CONFIG.sttProviderId,
      overrides: parsed.overrides || {},
    };
  } catch {
    // Missing or unreadable file → defaults. First write will create it.
    return { ...DEFAULT_CONFIG, overrides: {} };
  }
}

export async function writeConfig(config: ProviderConfigFile): Promise<void> {
  const dir = path.dirname(CONFIG_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
