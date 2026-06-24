// Z.Design - Anthropic Provider Adapter
// Supports Claude models via the Anthropic Messages API

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

export class AnthropicProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'anthropic';
  readonly name = 'Anthropic';
  readonly capabilities: ProviderCapability[] = [
    'llm-chat',
    'llm-streaming',
    'image-understanding',
  ];

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const model =
      request.model ||
      this.config.models.find((m) => m.type === 'llm')?.id ||
      'claude-sonnet-4-20250514';

    // Extract system message (Anthropic uses a separate system param)
    const systemMessage = request.messages.find((m) => m.role === 'system')?.content || '';
    const chatMessages = request.messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemMessage,
        messages: chatMessages,
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens || 8192,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.content?.[0]?.text || '',
      model: data.model || model,
      provider: 'anthropic',
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
            totalTokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          }
        : undefined,
      finishReason: data.stop_reason,
    };
  }

  async generateImage(_request: ImageGenRequest): Promise<ImageGenResponse> {
    // Anthropic doesn't support image generation — delegate to a configured image provider
    throw new Error(
      'Anthropic does not support image generation. Configure a separate image provider.'
    );
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) return false;
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 10,
        }),
        signal: AbortSignal.timeout(8000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
