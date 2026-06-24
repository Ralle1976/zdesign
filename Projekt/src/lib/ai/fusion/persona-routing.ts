// Z.Design - Fusion Persona Routing
// Maps each Fusion panel role to a PREFERRED provider+model, then resolves the
// best AVAILABLE provider at runtime. This is what gives the Fusion pipeline its
// model diversity: when a user has configured multiple providers (OpenAI,
// Anthropic, OpenRouter, ...) in ProviderSettings, different panel members run
// on different models. When only Z.ai is configured (the default), every role
// gracefully degrades to Z.ai so the pipeline always works.
//
// Pure functions only — take a ProviderConfig[] and return a provider id string,
// so the ProviderRegistry can call them without a circular import.

import type { ProviderConfig } from '../providers/types';

// ============ Persona Roles ============

export type PersonaRole =
  | 'creative-director' // Stage 1: brief
  | 'ux-architect' // Stage 2 panel
  | 'visual-designer' // Stage 2 panel
  | 'innovation-agent' // Stage 2 panel
  | 'critique-agent' // Stage 3: judge
  | 'synthesis-agent'; // Stage 4: synthesis

// ============ Preferred Provider + Model per Persona ============

interface PersonaPreference {
  /** provider config id from the registry's DEFAULT_PROVIDERS */
  preferredProviderId: string;
  /** model id hint passed to the adapter (Z.ai ignores this; others may use it) */
  preferredModel?: string;
}

// Chosen for cognitive diversity: different model families have different
// strengths (structured UX logic vs aesthetic JSON vs wild ideas vs deep
// reasoning vs JSON assembly). Falls back through active providers when absent.
export const PERSONA_MODEL_MAP: Record<PersonaRole, PersonaPreference> = {
  'creative-director': { preferredProviderId: 'anthropic-default', preferredModel: 'claude-sonnet-4-20250514' },
  'ux-architect': { preferredProviderId: 'anthropic-default', preferredModel: 'claude-sonnet-4-20250514' },
  'visual-designer': { preferredProviderId: 'openai-default', preferredModel: 'gpt-4o' },
  'innovation-agent': { preferredProviderId: 'openrouter-default', preferredModel: 'google/gemini-2.0-flash-001' },
  'critique-agent': { preferredProviderId: 'anthropic-default', preferredModel: 'claude-opus-4-20250514' },
  'synthesis-agent': { preferredProviderId: 'openai-default', preferredModel: 'gpt-4o' },
};

// ============ Availability Helpers ============

/** Z.ai needs no API key; every other provider is only usable with a key set. */
function isUsable(config: ProviderConfig): boolean {
  if (!config.isActive) return false;
  if (!config.capabilities.includes('llm-chat')) return false;
  if (config.provider === 'zai') return true; // keyless default
  return Boolean(config.apiKey && config.apiKey.trim().length > 0);
}

/**
 * Resolve the provider config id to use for a given persona.
 *
 * Strategy:
 *  1. If the persona's PREFERRED provider is active, configured, and supports
 *     llm-chat, use it (this is where diversity comes from).
 *  2. Otherwise, return the first USABLE active provider in priority order.
 *  3. As an absolute last resort, return 'zai-default' (always registered and
 *     keyless) so the pipeline never throws purely for lack of a provider.
 */
export function resolvePersonaProvider(
  role: PersonaRole,
  configs: ProviderConfig[],
): string {
  const pref = PERSONA_MODEL_MAP[role];

  // 1. Preferred provider, if usable
  const preferred = configs.find((c) => c.id === pref.preferredProviderId);
  if (preferred && isUsable(preferred)) {
    return preferred.id;
  }

  // 2. First usable active provider (configs are already priority-sorted upstream)
  const firstUsable = configs.find(isUsable);
  if (firstUsable) {
    return firstUsable.id;
  }

  // 3. Absolute fallback — Z.ai is always registered and needs no key
  return 'zai-default';
}

/** The model id hint for a persona (may be undefined for the brief stage). */
export function personaPreferredModel(role: PersonaRole): string | undefined {
  return PERSONA_MODEL_MAP[role].preferredModel;
}

/**
 * Describe the routing decision for logging/transparency. Returns one entry per
 * panel persona so callers can report which model each agent ran on.
 */
export function describeRouting(
  role: PersonaRole,
  resolvedProviderId: string,
  configs: ProviderConfig[],
): { role: PersonaRole; providerId: string; providerName: string; model?: string; isPreferred: boolean } {
  const config = configs.find((c) => c.id === resolvedProviderId);
  const preferred = PERSONA_MODEL_MAP[role].preferredProviderId;
  return {
    role,
    providerId: resolvedProviderId,
    providerName: config?.name ?? resolvedProviderId,
    model: personaPreferredModel(role),
    isPreferred: resolvedProviderId === preferred,
  };
}
