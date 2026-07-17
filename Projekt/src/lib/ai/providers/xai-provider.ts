// Z.Design - xAI Grok Provider Adapter

import { callXai } from '../xai-direct';
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

export class XAIProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'xai';
  readonly name = 'xAI Grok';
  readonly capabilities: ProviderCapability[] = ['llm-chat', 'llm-streaming'];

  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const prompt = request.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');
    const content = await callXai(prompt, {
      model: request.model,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
    });
    return {
      content,
      model: request.model || 'grok-4.5',
      provider: 'xai',
    };
  }

  async generateImage(_request: ImageGenRequest): Promise<ImageGenResponse> {
    throw new Error('xAI image generation uses xai-imagine via image-providers.ts');
  }

  async isAvailable(): Promise<boolean> {
    try {
      const key = this.config.apiKey?.trim() || process.env.XAI_API_KEY?.trim();
      return !!key;
    } catch {
      return false;
    }
  }
}