// Z.Design - OpenAI-Compatible Provider Adapter
// Supports OpenAI API and any OpenAI-compatible endpoint (e.g., Azure OpenAI, local models)

import type {
  AIProviderAdapter,
  ProviderType,
  LLMChatRequest,
  LLMChatResponse,
  ImageGenRequest,
  ImageGenResponse,
  ProviderCapability,
  ProviderConfig,
} from './types';

export class OpenAIProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'openai';
  readonly name = 'OpenAI';
  readonly capabilities: ProviderCapability[] = [
    'llm-chat',
    'llm-streaming',
    'image-generation',
    'image-understanding',
  ];

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
      ...(this.config.baseUrl?.includes('anthropic')
        ? { 'anthropic-version': '2023-06-01' }
        : {}),
    };
  }

  private getBaseUrl(): string {
    return this.config.baseUrl || 'https://api.openai.com/v1';
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const model =
      request.model || this.config.models.find((m) => m.type === 'llm')?.id || 'gpt-4o';
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
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || '',
      model: data.model || model,
      provider: 'openai',
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

  async generateImage(request: ImageGenRequest): Promise<ImageGenResponse> {
    const model = request.model || 'dall-e-3';
    const response = await fetch(`${this.getBaseUrl()}/images/generations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model,
        prompt: request.prompt,
        size: request.size || '1024x1024',
        n: request.n || 1,
        quality: 'hd',
      }),
    });
    if (!response.ok) {
      throw new Error(`OpenAI Image API error: ${response.status}`);
    }
    const data = await response.json();
    const img = data.data?.[0];
    return {
      url: img?.url || '',
      prompt: request.prompt,
      size: request.size || '1024x1024',
      model,
      provider: 'openai',
      revisedPrompt: img?.revised_prompt,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch(`${this.getBaseUrl()}/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
