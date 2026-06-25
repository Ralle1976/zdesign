// Z.Design — Provider Registry (settings/UI surface)
//
// Declares every known AI provider (text, image, audio) and reports whether it
// is currently CONFIGURED purely from environment variables. This is the
// read-only catalogue the ProviderSettingsDialog renders: it is intentionally
// a different concern from the heavyweight adapter router in
// `src/lib/ai/providers/registry.ts` (which does rate-limit-aware request
// routing for the node-tree fusion pipeline). This module never makes network
// calls — it only reads `process.env` to set each provider's `status` to
// "connected" (env var present) or "disconnected" (env var missing).
//
// `active` flags the provider that is currently selected as the default for its
// type; `getProviderConfig()` in ./config.ts is the source of truth for that.
//
// No external dependencies. Server-side only (reads process.env).

/** Modality a provider produces. */
export type ProviderType = "text" | "image" | "audio" | "video";

/** How a provider is reached. */
export type ProviderConnectionType = "api" | "mcp";

/** Observable reachability of a provider. */
export type ProviderStatus = "connected" | "disconnected" | "untested";

/** A single model offered by a provider. */
export interface ProviderModel {
  /** Model id sent to the API (e.g. "glm-5.2"). */
  id: string;
  /** Human-readable label for the dropdown. */
  label: string;
  /** Optional pricing hint, e.g. "$0.25 / 1M tok" or "~130/day free". */
  pricing?: string;
}

/** A declared provider with its current runtime status. */
export interface ProviderConfig {
  /** Stable identifier, e.g. "zai", "minimax-image". */
  id: string;
  /** Display name. */
  name: string;
  /** What this provider produces. */
  type: ProviderType;
  /** API endpoint or MCP server. */
  connectionType: ProviderConnectionType;
  /** Whether this provider is enabled (allowed to be selected). */
  enabled: boolean;
  /** Whether this provider is the currently selected default for its type. */
  active: boolean;
  /** Models this provider offers. */
  models: ProviderModel[];
  /** Currently selected model id (within `models`), if any. */
  selectedModel?: string;
  /** Name of the env var that holds the API key/token. */
  apiKeyEnv?: string;
  /** API base URL (for `connectionType: "api"`). */
  endpoint?: string;
  /** MCP server URL (for `connectionType: "mcp"`). */
  mcpUrl?: string;
  /** Human-readable quota hint, e.g. "~130/day free". */
  quota?: string;
  /** Reachability. Set from env at read time; can be refreshed by health-check. */
  status?: ProviderStatus;
}

/**
 * Build the full provider catalogue with live `status` derived from env vars.
 *
 * Pure function: reads `process.env` once per call, returns a fresh array. Safe
 * to call on every settings-dialog render. A provider is "connected" iff its
 * `apiKeyEnv` is present and non-empty in the environment.
 */
export function getProviderRegistry(): ProviderConfig[] {
  const has = (envName?: string): boolean =>
    !!envName && !!process.env[envName] && process.env[envName]!.trim().length > 0;

  const providers: ProviderConfig[] = [
    // ============ TEXT ============
    {
      id: "zai",
      name: "Z.ai (GLM)",
      type: "text",
      connectionType: "api",
      enabled: true,
      active: true,
      models: [
        { id: "glm-5.2", label: "GLM-5.2", pricing: "coding plan" },
        { id: "glm-5.1", label: "GLM-5.1" },
        { id: "glm-4.7-turbo", label: "GLM Turbo", pricing: "fast" },
      ],
      selectedModel: "glm-5.2",
      apiKeyEnv: "ZAI_API_KEY",
      endpoint: "https://api.z.ai/api/anthropic",
      quota: "coding plan",
      status: has("ZAI_API_KEY") ? "connected" : "disconnected",
    },
    {
      id: "minimax-text",
      name: "MiniMax Text",
      type: "text",
      connectionType: "api",
      enabled: true,
      active: false,
      models: [
        { id: "MiniMax-M3", label: "MiniMax-M3" },
        { id: "MiniMax-M1", label: "MiniMax-M1" },
      ],
      selectedModel: "MiniMax-M3",
      apiKeyEnv: "MINIMAX_API_KEY",
      endpoint: "https://api.minimax.io/anthropic",
      quota: "coding plan",
      status: has("MINIMAX_API_KEY") ? "connected" : "disconnected",
    },
    {
      id: "openrouter",
      name: "OpenRouter",
      type: "text",
      connectionType: "api",
      enabled: true,
      active: false,
      models: [
        { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4", pricing: "$3 / 1M" },
        { id: "openai/gpt-4o", label: "GPT-4o", pricing: "$2.5 / 1M" },
        { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
      ],
      apiKeyEnv: "OPENROUTER_API_KEY",
      endpoint: "https://openrouter.ai/api/v1",
      status: has("OPENROUTER_API_KEY") ? "connected" : "disconnected",
    },

    // ============ IMAGE ============
    {
      id: "minimax-image",
      name: "MiniMax Image",
      type: "image",
      connectionType: "api",
      enabled: true,
      active: true,
      models: [{ id: "image-01", label: "image-01", pricing: "~130/day free" }],
      selectedModel: "image-01",
      apiKeyEnv: "MINIMAX_API_KEY",
      endpoint: "https://api.minimax.io/v1",
      quota: "~130/day free",
      status: has("MINIMAX_API_KEY") ? "connected" : "disconnected",
    },
    {
      id: "higgsfield",
      name: "Higgsfield",
      type: "image",
      connectionType: "mcp",
      enabled: true,
      active: false,
      models: [
        { id: "nano-banana-pro", label: "Nano Banana Pro" },
        { id: "flux-2", label: "Flux 2" },
        { id: "gpt-image", label: "GPT Image" },
      ],
      selectedModel: "nano-banana-pro",
      apiKeyEnv: "HIGGSFIELD_API_TOKEN",
      mcpUrl: "https://mcp.higgsfield.ai/mcp",
      status: has("HIGGSFIELD_API_TOKEN") ? "connected" : "disconnected",
    },
    {
      id: "replicate",
      name: "Replicate (FLUX)",
      type: "image",
      connectionType: "api",
      enabled: true,
      active: false,
      models: [
        { id: "black-forest-labs/flux-schnell", label: "FLUX Schnell", pricing: "$0.003/img" },
        { id: "black-forest-labs/flux-dev", label: "FLUX Dev", pricing: "$0.025/img" },
      ],
      selectedModel: "black-forest-labs/flux-schnell",
      apiKeyEnv: "REPLICATE_API_TOKEN",
      endpoint: "https://api.replicate.com",
      status: has("REPLICATE_API_TOKEN") ? "connected" : "disconnected",
    },
    {
      id: "zai-image",
      name: "Z.ai Image",
      type: "image",
      connectionType: "api",
      enabled: true,
      active: false,
      models: [{ id: "glm-image", label: "GLM-Image" }],
      selectedModel: "glm-image",
      apiKeyEnv: "ZAI_API_KEY",
      endpoint: "https://api.z.ai/api/paas/v4",
      quota: "coding plan",
      status: has("ZAI_API_KEY") ? "connected" : "disconnected",
    },

    // ============ AUDIO ============
    {
      id: "zai-asr",
      name: "Z.ai ASR",
      type: "audio",
      connectionType: "api",
      enabled: true,
      active: false,
      models: [{ id: "glm-asr-2512", label: "GLM-ASR-2512" }],
      selectedModel: "glm-asr-2512",
      apiKeyEnv: "ZAI_API_KEY",
      endpoint: "https://api.z.ai/api/paas/v4/audio/transcriptions",
      quota: "coding plan",
      status: has("ZAI_API_KEY") ? "connected" : "disconnected",
    },
  ];

  return providers;
}

/**
 * Look up a single provider by id. Returns `undefined` if unknown.
 */
export function getProviderById(providerId: string): ProviderConfig | undefined {
  return getProviderRegistry().find((p) => p.id === providerId);
}

/**
 * All providers of a given modality.
 */
export function getProvidersByType(type: ProviderType): ProviderConfig[] {
  return getProviderRegistry().filter((p) => p.type === type);
}
