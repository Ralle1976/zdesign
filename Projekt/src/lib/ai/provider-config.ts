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
}

export interface ProviderConfigFile {
  textProviderId: string;
  imageProviderId: string;
  /** Per-provider overrides keyed by provider id. */
  overrides: Record<
    string,
    {
      enabled?: boolean;
      model?: string;
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
    name: 'Z.ai (Anthropic direct)',
    kind: 'text',
    envKey: 'ZAI_API_KEY',
    envBaseUrl: 'ZAI_BASE_URL',
    defaultModel: process.env.ZAI_MODEL || 'claude-sonnet-4-20250514',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    ],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    kind: 'text',
    envKey: 'OPENROUTER_API_KEY',
    envBaseUrl: 'OPENROUTER_BASE_URL',
    defaultModel: 'anthropic/claude-sonnet-4',
    models: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)' },
      { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4 (via OpenRouter)' },
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)' },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (via OpenRouter)' },
    ],
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    kind: 'image',
    envKey: 'MINIMAX_API_KEY',
    envBaseUrl: 'MINIMAX_BASE_URL',
    defaultModel: 'image-01',
    models: [
      { id: 'image-01', name: 'MiniMax image-01' },
      { id: 'abab6.5s-image', name: 'abab6.5s image' },
    ],
  },
  {
    id: 'higgsfield',
    name: 'Higgsfield',
    kind: 'image',
    envKey: 'HIGGSFIELD_API_TOKEN',
    defaultModel: 'default',
    models: [{ id: 'default', name: 'Higgsfield default' }],
  },
  {
    id: 'replicate',
    name: 'Replicate (FLUX)',
    kind: 'image',
    envKey: 'REPLICATE_API_TOKEN',
    defaultModel: 'black-forest-labs/flux-schnell',
    models: [
      { id: 'black-forest-labs/flux-schnell', name: 'FLUX schnell' },
      { id: 'black-forest-labs/flux-dev', name: 'FLUX dev' },
    ],
  },
];

// ============ Helpers ============

const CONFIG_PATH = path.join(process.cwd(), 'data', 'provider-config.json');

const DEFAULT_CONFIG: ProviderConfigFile = {
  textProviderId: 'zai',
  imageProviderId: 'minimax',
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
  return {
    ...provider,
    configured: !!key,
    maskedKey: maskKey(key),
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
