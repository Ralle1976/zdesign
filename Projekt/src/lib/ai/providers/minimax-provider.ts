// Z.Design - Minimax Provider Adapter
// Supports Minimax API for chat completions (OpenAI-compatible) and image generation

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

const MINIMAX_BASE_URL = 'https://api.minimax.chat/v1';

// ============ Static Model Definitions ============

const MINIMAX_MODELS: DynamicModelInfo[] = [
  {
    id: 'MiniMax-Text-01',
    name: 'MiniMax-Text-01',
    description: 'MiniMax flagship model with 200k context, supports chat and vision',
    contextLength: 200000,
    maxOutputTokens: 16384,
    pricing: { prompt: 1, completion: 2 },
    isFree: false,
    capabilities: ['llm-chat', 'image-understanding'],
    modality: ['text', 'image'],
    architecture: {
      modality: 'text+image',
      tokenizer: 'MiniMax',
      instructType: 'chat',
    },
  },
  {
    id: 'MiniMax-M1',
    name: 'MiniMax-M1',
    description: 'MiniMax reasoning model with 200k context',
    contextLength: 200000,
    maxOutputTokens: 16384,
    pricing: { prompt: 2, completion: 8 },
    isFree: false,
    capabilities: ['llm-chat'],
    modality: ['text'],
    architecture: {
      modality: 'text',
      tokenizer: 'MiniMax',
      instructType: null,
    },
  },
  {
    id: 'abab6.5s-chat',
    name: 'abab6.5s-chat',
    description: 'Minimax lightweight chat model with 128k context',
    contextLength: 128000,
    maxOutputTokens: 8192,
    pricing: { prompt: 0.5, completion: 1 },
    isFree: false,
    capabilities: ['llm-chat'],
    modality: ['text'],
    architecture: {
      modality: 'text',
      tokenizer: 'MiniMax',
      instructType: 'chat',
    },
  },
  {
    id: 'abab6.5-chat',
    name: 'abab6.5-chat',
    description: 'Minimax chat model with 128k context',
    contextLength: 128000,
    maxOutputTokens: 8192,
    pricing: { prompt: 1, completion: 2 },
    isFree: false,
    capabilities: ['llm-chat'],
    modality: ['text'],
    architecture: {
      modality: 'text',
      tokenizer: 'MiniMax',
      instructType: 'chat',
    },
  },
  {
    id: 'abab6.5s-image',
    name: 'abab6.5s-image',
    description: 'Minimax image generation model',
    contextLength: 4096,
    maxOutputTokens: 4096,
    pricing: { prompt: 0, completion: 0, image: 0.04 },
    isFree: false,
    capabilities: ['image-generation'],
    modality: ['text', 'image'],
    architecture: {
      modality: 'text->image',
      tokenizer: 'MiniMax',
      instructType: null,
    },
  },
];

export class MinimaxProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'minimax';
  readonly name = 'Minimax';
  readonly capabilities: ProviderCapability[] = [
    'llm-chat',
    'llm-streaming',
    'image-generation',
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
    };
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || MINIMAX_BASE_URL;
  }

  // ============ Rate Limit Tracking ============

  getRateLimits(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  updateRateLimits(headers: Headers): void {
    const limit = headers.get('X-RateLimit-Limit') || headers.get('x-ratelimit-limit');
    const remaining = headers.get('X-RateLimit-Remaining') || headers.get('x-ratelimit-remaining');
    const reset = headers.get('X-RateLimit-Reset') || headers.get('x-ratelimit-reset');

    if (limit !== null) {
      this.rateLimitInfo.requestsLimit = parseInt(limit, 10) || 0;
    }
    if (remaining !== null) {
      this.rateLimitInfo.requestsRemaining = parseInt(remaining, 10) || 0;
    }
    if (reset !== null) {
      const resetValue = parseInt(reset, 10);
      if (!isNaN(resetValue)) {
        this.rateLimitInfo.requestsResetAt = resetValue > 1e10
          ? new Date(resetValue)
          : new Date(Date.now() + resetValue * 1000);
      }
    }

    // Track token-level rate limits if available
    const tokensLimit = headers.get('X-RateLimit-Tokens-Limit');
    const tokensRemaining = headers.get('X-RateLimit-Tokens-Remaining');
    const tokensReset = headers.get('X-RateLimit-Tokens-Reset');

    if (tokensLimit !== null) {
      this.rateLimitInfo.tokensLimit = parseInt(tokensLimit, 10) || 0;
    }
    if (tokensRemaining !== null) {
      this.rateLimitInfo.tokensRemaining = parseInt(tokensRemaining, 10) || 0;
    }
    if (tokensReset !== null) {
      const resetValue = parseInt(tokensReset, 10);
      if (!isNaN(resetValue)) {
        this.rateLimitInfo.tokensResetAt = resetValue > 1e10
          ? new Date(resetValue)
          : new Date(Date.now() + resetValue * 1000);
      }
    }
  }

  // ============ Dynamic Model Fetching (Static List) ============

  async fetchModels(): Promise<DynamicModelInfo[]> {
    // Minimax doesn't have a public models endpoint, so return static list
    return [...MINIMAX_MODELS];
  }

  // ============ Chat Completion ============

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const model =
      request.model || this.config.models.find((m) => m.type === 'llm')?.id || 'MiniMax-Text-01';

    const response = await fetch(`${this.getBaseUrl()}/text/chatcompletion_v2`, {
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
      const err = new Error(`Minimax rate limit exceeded`);
      (err as Error & { statusCode?: number }).statusCode = 429;
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Minimax API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || model,
      provider: 'minimax',
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

  async generateImage(request: ImageGenRequest): Promise<ImageGenResponse> {
    const model = request.model || 'abab6.5s-image';

    const response = await fetch(`${this.getBaseUrl()}/image/generation`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        n: request.n || 1,
        size: request.size || '1024x1024',
      }),
    });

    // Update rate limits from response headers
    this.updateRateLimits(response.headers);

    if (response.status === 429) {
      const err = new Error(`Minimax image rate limit exceeded`);
      (err as Error & { statusCode?: number }).statusCode = 429;
      throw err;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Minimax Image API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const img = data.data?.[0];
    return {
      url: img?.url || img?.b64_json ? `data:image/png;base64,${img.b64_json}` : '',
      prompt: request.prompt,
      size: request.size || '1024x1024',
      model,
      provider: 'minimax',
      revisedPrompt: img?.revised_prompt,
    };
  }

  // ============ Health Check ============

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      // Minimax doesn't have a lightweight health endpoint, so try a minimal chat request
      const response = await fetch(`${this.getBaseUrl()}/text/chatcompletion_v2`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: 'abab6.5s-chat',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(8000),
      });
      this.updateRateLimits(response.headers);
      return response.ok;
    } catch {
      return false;
    }
  }
}
