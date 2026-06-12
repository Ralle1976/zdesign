// Z.Design - Provider Registry
// Central registry that manages all AI providers and intelligently routes requests
// Supports rate limit tracking and auto-rotation when providers are rate-limited

import type {
  AIProviderAdapter,
  ProviderConfig,
  ProviderType,
  LLMChatRequest,
  LLMChatResponse,
  ImageGenRequest,
  ImageGenResponse,
  ProviderCapability,
  RateLimitInfo,
} from './types';
import { ZAIProvider } from './zai-provider';
import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { OpenRouterProvider } from './openrouter-provider';
import { MinimaxProvider } from './minimax-provider';

// ============ Default Provider Configurations ============

const DEFAULT_PROVIDERS: ProviderConfig[] = [
  {
    id: 'zai-default',
    name: 'Z.ai',
    provider: 'zai',
    models: [
      { id: 'zai-default', name: 'Z.ai Default', type: 'llm', capabilities: ['llm-chat'] },
      { id: 'zai-image', name: 'Z.ai Image', type: 'image', capabilities: ['image-generation'] },
    ],
    capabilities: ['llm-chat', 'image-generation', 'image-understanding', 'speech-to-text', 'text-to-speech'],
    isActive: true,
    priority: 0,
    config: {},
  },
  {
    id: 'openai-default',
    name: 'OpenAI',
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 128000 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', type: 'llm', capabilities: ['llm-chat'], maxTokens: 128000 },
      { id: 'dall-e-3', name: 'DALL-E 3', type: 'image', capabilities: ['image-generation'] },
    ],
    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding'],
    isActive: false,
    priority: 1,
    config: {},
  },
  {
    id: 'anthropic-default',
    name: 'Anthropic Claude',
    provider: 'anthropic',
    apiKey: '',
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 200000 },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 200000 },
    ],
    capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
    isActive: false,
    priority: 2,
    config: {},
  },
  {
    id: 'openrouter-default',
    name: 'OpenRouter',
    provider: 'openrouter',
    apiKey: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'openai/gpt-4o', name: 'GPT-4o (via OpenRouter)', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 128000 },
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4 (via OpenRouter)', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 200000 },
      { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash (via OpenRouter)', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 1048576 },
      { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B (via OpenRouter)', type: 'llm', capabilities: ['llm-chat'], maxTokens: 131072 },
    ],
    capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
    isActive: false,
    priority: 3,
    config: {},
  },
  {
    id: 'minimax-default',
    name: 'Minimax',
    provider: 'minimax',
    apiKey: '',
    baseUrl: 'https://api.minimax.chat/v1',
    models: [
      { id: 'MiniMax-Text-01', name: 'MiniMax-Text-01', type: 'llm', capabilities: ['llm-chat', 'image-understanding'], maxTokens: 200000 },
      { id: 'MiniMax-M1', name: 'MiniMax-M1', type: 'llm', capabilities: ['llm-chat'], maxTokens: 200000 },
      { id: 'abab6.5s-chat', name: 'abab6.5s-chat', type: 'llm', capabilities: ['llm-chat'], maxTokens: 128000 },
      { id: 'abab6.5-chat', name: 'abab6.5-chat', type: 'llm', capabilities: ['llm-chat'], maxTokens: 128000 },
      { id: 'abab6.5s-image', name: 'abab6.5s-image', type: 'image', capabilities: ['image-generation'] },
    ],
    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding'],
    isActive: false,
    priority: 4,
    config: {},
  },
];

// ============ Provider Registry ============

export class ProviderRegistry {
  private adapters: Map<string, AIProviderAdapter> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();
  private rateLimits: Map<string, RateLimitInfo> = new Map();
  private static instance: ProviderRegistry | null = null;

  private constructor() {
    // Initialize with default provider configs
    for (const config of DEFAULT_PROVIDERS) {
      this.configs.set(config.id, config);
    }
    // Always register Z.ai as the default (no API key needed)
    this.registerAdapter('zai-default', new ZAIProvider());
  }

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  // ============ Adapter Management ============

  registerAdapter(id: string, adapter: AIProviderAdapter): void {
    this.adapters.set(id, adapter);
  }

  registerProvider(config: ProviderConfig): void {
    this.configs.set(config.id, config);
    // Create adapter based on provider type
    switch (config.provider) {
      case 'openai':
        this.adapters.set(config.id, new OpenAIProvider(config));
        break;
      case 'anthropic':
        this.adapters.set(config.id, new AnthropicProvider(config));
        break;
      case 'zai':
        this.adapters.set(config.id, new ZAIProvider());
        break;
      case 'openrouter':
        this.adapters.set(config.id, new OpenRouterProvider(config));
        break;
      case 'minimax':
        this.adapters.set(config.id, new MinimaxProvider(config));
        break;
    }
  }

  removeProvider(id: string): void {
    this.configs.delete(id);
    this.adapters.delete(id);
    this.rateLimits.delete(id);
  }

  updateProvider(id: string, updates: Partial<ProviderConfig>): void {
    const existing = this.configs.get(id);
    if (!existing) return;
    const updated = { ...existing, ...updates };
    this.configs.set(id, updated);
    // Re-create adapter with new config if relevant fields changed
    if (updates.apiKey !== undefined || updates.baseUrl !== undefined || updates.provider !== undefined) {
      this.registerProvider(updated);
    }
  }

  // ============ Query Methods ============

  getProvider(id: string): AIProviderAdapter | undefined {
    return this.adapters.get(id);
  }

  getConfig(id: string): ProviderConfig | undefined {
    return this.configs.get(id);
  }

  getAllConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values()).sort((a, b) => a.priority - b.priority);
  }

  getActiveProviders(): ProviderConfig[] {
    return this.getAllConfigs().filter((c) => c.isActive);
  }

  // ============ Rate Limit Management ============

  /**
   * Update rate limit info for a provider from response headers.
   * Delegates to the provider's own updateRateLimits if it supports ProviderWithRateLimits,
   * and also stores a copy in the registry for routing decisions.
   */
  updateRateLimits(providerId: string, headers: Headers): void {
    const adapter = this.adapters.get(providerId);
    if (adapter && 'updateRateLimits' in adapter && typeof adapter.updateRateLimits === 'function') {
      adapter.updateRateLimits(headers);
    }

    // Also track in registry's own map for routing decisions
    const existing = this.rateLimits.get(providerId) || {
      requestsLimit: 0,
      requestsRemaining: 0,
      requestsResetAt: null,
      tokensLimit: 0,
      tokensRemaining: 0,
      tokensResetAt: null,
    };

    const limit = headers.get('X-RateLimit-Limit') || headers.get('x-ratelimit-limit');
    const remaining = headers.get('X-RateLimit-Remaining') || headers.get('x-ratelimit-remaining');
    const reset = headers.get('X-RateLimit-Reset') || headers.get('x-ratelimit-reset');

    if (limit !== null) {
      existing.requestsLimit = parseInt(limit, 10) || 0;
    }
    if (remaining !== null) {
      existing.requestsRemaining = parseInt(remaining, 10) || 0;
    }
    if (reset !== null) {
      const resetValue = parseInt(reset, 10);
      if (!isNaN(resetValue)) {
        existing.requestsResetAt = resetValue > 1e10
          ? new Date(resetValue)
          : new Date(Date.now() + resetValue * 1000);
      }
    }

    const tokensLimit = headers.get('X-RateLimit-Tokens-Limit');
    const tokensRemaining = headers.get('X-RateLimit-Tokens-Remaining');
    const tokensReset = headers.get('X-RateLimit-Tokens-Reset');

    if (tokensLimit !== null) {
      existing.tokensLimit = parseInt(tokensLimit, 10) || 0;
    }
    if (tokensRemaining !== null) {
      existing.tokensRemaining = parseInt(tokensRemaining, 10) || 0;
    }
    if (tokensReset !== null) {
      const resetValue = parseInt(tokensReset, 10);
      if (!isNaN(resetValue)) {
        existing.tokensResetAt = resetValue > 1e10
          ? new Date(resetValue)
          : new Date(Date.now() + resetValue * 1000);
      }
    }

    this.rateLimits.set(providerId, existing);
  }

  /**
   * Get rate limit info for a specific provider.
   */
  getProviderRateLimits(providerId: string): RateLimitInfo | null {
    // First check the provider's own rate limit info
    const adapter = this.adapters.get(providerId);
    if (adapter && 'getRateLimits' in adapter && typeof adapter.getRateLimits === 'function') {
      return adapter.getRateLimits();
    }
    // Fall back to registry's tracked info
    return this.rateLimits.get(providerId) || null;
  }

  /**
   * Check if a provider is currently rate-limited (no remaining requests).
   */
  private isRateLimited(providerId: string): boolean {
    const info = this.rateLimits.get(providerId);
    if (!info) return false;
    // If we've never seen rate limit headers, don't assume it's limited
    if (info.requestsLimit === 0) return false;
    // If remaining is <= 0, it's rate limited
    if (info.requestsRemaining <= 0) {
      // Check if reset time has passed
      if (info.requestsResetAt && info.requestsResetAt <= new Date()) {
        // Reset window has passed, clear rate limit
        info.requestsRemaining = info.requestsLimit;
        return false;
      }
      return true;
    }
    return false;
  }

  // ============ Smart Routing ============

  /**
   * Find the best available provider for a given capability.
   * Iterates active providers in priority order, skipping rate-limited ones,
   * and returns the first one that passes a health check.
   * Falls back to Z.ai if no other provider is available.
   */
  async getProviderForCapability(capability: ProviderCapability): Promise<AIProviderAdapter | null> {
    const activeConfigs = this.getActiveProviders();
    for (const config of activeConfigs) {
      if (config.capabilities.includes(capability)) {
        // Skip rate-limited providers
        if (this.isRateLimited(config.id)) {
          console.warn(`[ProviderRegistry] Skipping rate-limited provider: ${config.name}`);
          continue;
        }
        const adapter = this.adapters.get(config.id);
        if (adapter) {
          try {
            const available = await adapter.isAvailable();
            if (available) return adapter;
          } catch {
            continue;
          }
        }
      }
    }
    // Fallback to Z.ai
    return this.adapters.get('zai-default') || null;
  }

  // ============ High-Level API ============

  /**
   * Chat with automatic provider selection and rate-limit-aware rotation.
   * If a preferred provider is specified, tries it first; otherwise falls back to
   * the highest-priority active provider that supports LLM chat.
   * Skips providers that are rate-limited and auto-rotates on 429 errors.
   */
  async chat(request: LLMChatRequest, preferredProvider?: string): Promise<LLMChatResponse> {
    // If a specific provider is requested, try it first
    if (preferredProvider) {
      // Check if the preferred provider is rate-limited
      if (this.isRateLimited(preferredProvider)) {
        console.warn(`[ProviderRegistry] Preferred provider ${preferredProvider} is rate-limited, skipping`);
      } else {
        const adapter = this.adapters.get(preferredProvider);
        if (adapter) {
          try {
            const response = await adapter.chat(request);
            return response;
          } catch (e) {
            // If 429, mark as rate-limited and rotate
            if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 429) {
              console.warn(`[ProviderRegistry] Provider ${preferredProvider} hit rate limit (429), rotating`);
              this.markRateLimited(preferredProvider);
            } else {
              console.warn(`[ProviderRegistry] Provider ${preferredProvider} failed, falling back:`, e);
            }
          }
        }
      }
    }

    // Try all active providers in priority order, skipping rate-limited ones
    const activeConfigs = this.getActiveProviders();
    for (const config of activeConfigs) {
      if (!config.capabilities.includes('llm-chat')) continue;
      if (preferredProvider && config.id === preferredProvider) continue; // Already tried

      // Check rate limits before calling
      if (this.isRateLimited(config.id)) {
        console.warn(`[ProviderRegistry] Skipping rate-limited provider: ${config.name}`);
        continue;
      }

      const adapter = this.adapters.get(config.id);
      if (!adapter) continue;
      try {
        const response = await adapter.chat(request);
        return response;
      } catch (e) {
        // If 429, mark as rate-limited and rotate to next
        if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 429) {
          console.warn(`[ProviderRegistry] Provider ${config.name} hit rate limit (429), rotating to next`);
          this.markRateLimited(config.id);
          continue;
        }
        console.warn(`[ProviderRegistry] Provider ${config.name} failed:`, e);
        continue;
      }
    }

    throw new Error('No LLM provider available (all providers may be rate-limited or unavailable)');
  }

  /**
   * Image generation with automatic provider selection and rate-limit-aware rotation.
   * If a preferred provider is specified, tries it first; otherwise falls back to
   * the highest-priority active provider that supports image generation.
   */
  async generateImage(request: ImageGenRequest, preferredProvider?: string): Promise<ImageGenResponse> {
    if (preferredProvider) {
      if (this.isRateLimited(preferredProvider)) {
        console.warn(`[ProviderRegistry] Preferred image provider ${preferredProvider} is rate-limited, skipping`);
      } else {
        const adapter = this.adapters.get(preferredProvider);
        if (adapter && adapter.capabilities.includes('image-generation')) {
          try {
            return await adapter.generateImage(request);
          } catch (e) {
            if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 429) {
              console.warn(`[ProviderRegistry] Image provider ${preferredProvider} hit rate limit (429), rotating`);
              this.markRateLimited(preferredProvider);
            } else {
              console.warn(`[ProviderRegistry] Image provider ${preferredProvider} failed, falling back:`, e);
            }
          }
        }
      }
    }

    const activeConfigs = this.getActiveProviders();
    for (const config of activeConfigs) {
      if (!config.capabilities.includes('image-generation')) continue;
      if (preferredProvider && config.id === preferredProvider) continue;

      if (this.isRateLimited(config.id)) {
        console.warn(`[ProviderRegistry] Skipping rate-limited image provider: ${config.name}`);
        continue;
      }

      const adapter = this.adapters.get(config.id);
      if (!adapter) continue;
      try {
        return await adapter.generateImage(request);
      } catch (e) {
        if (e instanceof Error && (e as Error & { statusCode?: number }).statusCode === 429) {
          console.warn(`[ProviderRegistry] Image provider ${config.name} hit rate limit (429), rotating`);
          this.markRateLimited(config.id);
          continue;
        }
        console.warn(`[ProviderRegistry] Image provider ${config.name} failed:`, e);
        continue;
      }
    }

    throw new Error('No image generation provider available (all providers may be rate-limited or unavailable)');
  }

  // ============ Private Helpers ============

  /**
   * Mark a provider as rate-limited by setting remaining requests to 0.
   */
  private markRateLimited(providerId: string): void {
    const existing = this.rateLimits.get(providerId) || {
      requestsLimit: 0,
      requestsRemaining: 0,
      requestsResetAt: null,
      tokensLimit: 0,
      tokensRemaining: 0,
      tokensResetAt: null,
    };
    existing.requestsRemaining = 0;
    // Set a default reset window of 60 seconds if no reset time known
    if (!existing.requestsResetAt) {
      existing.requestsResetAt = new Date(Date.now() + 60_000);
    }
    this.rateLimits.set(providerId, existing);
  }
}
