// Z.Design - OpenRouter Provider Adapter
// Supports OpenRouter API for accessing multiple AI models through a unified endpoint
// OpenRouter is OpenAI-compatible, so chat completions use the same format

import type {
  AIProviderAdapter,
  ProviderType,
  LLMChatRequest,
  LLMChatResponse,
  ImageGenRequest,
  ImageGenResponse,
  ProviderCapability,
  ProviderConfig,
  RateLimitInfo,
  DynamicModelInfo,
} from './types';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

export class OpenRouterProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'openrouter';
  readonly name = 'OpenRouter';
  readonly capabilities: ProviderCapability[] = [
    'llm-chat',
    'llm-streaming',
    'image-understanding',
  ];

  private config: ProviderConfig;
  private rateLimitInfo: RateLimitInfo = {
    requestsLimit: 0,
    requestsRemaining: 0,
    requestsResetAt: null,
    tokensLimit: 0,
    tokensRemaining: 0,
    tokensResetAt: null,
  };

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      'HTTP-Referer': this.config.config?.siteUrl as string || '',
      'X-Title': this.config.config?.appName as string || 'Z.Design',
    };
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || OPENROUTER_BASE_URL;
  }

  // ============ Rate Limit Tracking ============

  getRateLimits(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  updateRateLimits(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');

    if (limit !== null) {
      this.rateLimitInfo.requestsLimit = parseInt(limit, 10) || 0;
    }
    if (remaining !== null) {
      this.rateLimitInfo.requestsRemaining = parseInt(remaining, 10) || 0;
    }
    if (reset !== null) {
      const resetValue = parseInt(reset, 10);
      if (!isNaN(resetValue)) {
        // Reset value can be a Unix timestamp or seconds until reset
        this.rateLimitInfo.requestsResetAt = resetValue > 1e10
          ? new Date(resetValue)
          : new Date(Date.now() + resetValue * 1000);
      }
    }
  }

  // ============ Dynamic Model Fetching ============

  async fetchModels(): Promise<DynamicModelInfo[]> {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter models API error: ${response.status}`);
    }

    const data = await response.json();
    const models: Array<Record<string, unknown>> = data.data || [];

    return models.map((model) => {
      const id = (model.id as string) || '';
      const name = (model.name as string) || id;
      const description = model.description as string | undefined;
      const contextLength = (model.context_length as number) || 4096;
      const maxOutputTokens = model.max_output_tokens as number | undefined;
      const pricing = model.pricing as Record<string, string> | undefined;
      const architecture = model.architecture as Record<string, unknown> | undefined;
      const topProvider = model.top_provider as Record<string, unknown> | undefined;

      const promptPrice = parseFloat(pricing?.prompt || '0');
      const completionPrice = parseFloat(pricing?.completion || '0');
      const imagePrice = pricing?.image ? parseFloat(pricing.image) : undefined;

      const isFree = promptPrice === 0 && completionPrice === 0;

      // Determine capabilities from architecture
      const capabilities: ProviderCapability[] = [];
      const modality = architecture?.modality as string | undefined;
      const instructType = architecture?.instruct_type as string | null | undefined;

      if (modality?.includes('text') || instructType || id.includes('chat') || id.includes('instruct')) {
        capabilities.push('llm-chat');
      }
      if (modality?.includes('image') || id.includes('vision')) {
        capabilities.push('image-understanding');
      }
      // If no capabilities detected, default to llm-chat for text models
      if (capabilities.length === 0) {
        capabilities.push('llm-chat');
      }

      // Build modality list from architecture
      const modalityList: string[] = [];
      if (modality) {
        // modality can be "text+image" or similar formats
        if (modality.includes('text')) modalityList.push('text');
        if (modality.includes('image')) modalityList.push('image');
        if (modality.includes('audio')) modalityList.push('audio');
        if (modality.includes('video')) modalityList.push('video');
      }

      const maxTokens = (topProvider?.max_completion_tokens as number) || maxOutputTokens;

      return {
        id,
        name,
        description,
        contextLength,
        maxOutputTokens: maxTokens,
        pricing: {
          prompt: promptPrice,
          completion: completionPrice,
          ...(imagePrice !== undefined ? { image: imagePrice } : {}),
        },
        isFree,
        capabilities,
        ...(modalityList.length > 0 ? { modality: modalityList } : {}),
        ...(architecture ? {
          architecture: {
            modality: (architecture.modality as string) || '',
            tokenizer: (architecture.tokenizer as string) || '',
            instructType: (architecture.instruct_type as string | null) || null,
          },
        } : {}),
      } satisfies DynamicModelInfo;
    });
  }

  // ============ Chat Completion ============

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const model =
      request.model || this.config.models.find((m) => m.type === 'llm')?.id || 'openai/gpt-4o';

    const response = await fetch(`${this.getBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens,
      }),
    });

    // Update rate limits from response headers
    this.updateRateLimits(response.headers);

    if (response.status === 429) {
      const err = new Error(`OpenRouter rate limit exceeded`);
      (err as Error & { statusCode?: number }).statusCode = 429;
      throw err;
    }

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || model,
      provider: 'openrouter',
      usage: data.usage
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens,
          }
        : undefined,
      finishReason: data.choices[0]?.finish_reason,
    };
  }

  // ============ Image Generation ============

  async generateImage(_request: ImageGenRequest): Promise<ImageGenResponse> {
    // OpenRouter primarily routes LLM requests; image generation is not natively supported
    throw new Error(
      'OpenRouter does not directly support image generation. Use a dedicated image provider.'
    );
  }

  // ============ Health Check ============

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      this.updateRateLimits(response.headers);
      return response.ok;
    } catch {
      return false;
    }
  }
}
