// Z.Design - Z.ai Provider Adapter
// Default provider using z-ai-web-dev-sdk (no API key required)

import ZAI from 'z-ai-web-dev-sdk';
import type {
  AIProviderAdapter,
  ProviderType,
  LLMChatRequest,
  LLMChatResponse,
  ImageGenRequest,
  ImageGenResponse,
  ProviderCapability,
} from './types';

export class ZAIProvider implements AIProviderAdapter {
  readonly type: ProviderType = 'zai';
  readonly name = 'Z.ai';
  readonly capabilities: ProviderCapability[] = [
    'llm-chat',
    'image-generation',
    'image-understanding',
    'speech-to-text',
    'text-to-speech',
  ];

  private zaiInstance: ZAI | null = null;

  private async getZAI(): Promise<ZAI> {
    if (!this.zaiInstance) {
      this.zaiInstance = await ZAI.create();
    }
    return this.zaiInstance;
  }

  async chat(request: LLMChatRequest): Promise<LLMChatResponse> {
    const zai = await this.getZAI();
    const completion = await zai.chat.completions.create({
      messages: request.messages,
      thinking: { type: 'disabled' },
    });
    return {
      content: completion.choices[0]?.message?.content || '',
      model: completion.model || 'zai-default',
      provider: 'zai',
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens || 0,
            completionTokens: completion.usage.completion_tokens || 0,
            totalTokens: completion.usage.total_tokens || 0,
          }
        : undefined,
      finishReason: completion.choices[0]?.finish_reason,
    };
  }

  async generateImage(request: ImageGenRequest): Promise<ImageGenResponse> {
    const zai = await this.getZAI();
    // @ts-expect-error pre-existing: SDK images API uses generations.create, not generate
    const result = await zai.images.generate({
      prompt: request.prompt,
      size: request.size || '1024x1024',
    });
    const imageData = result.data?.[0] || result;
    const imageUrl =
      imageData?.url ||
      (imageData?.b64_json ? `data:image/png;base64,${imageData.b64_json}` : '');
    return {
      url: imageUrl,
      prompt: request.prompt,
      size: request.size || '1024x1024',
      model: 'zai-image',
      provider: 'zai',
      revisedPrompt: imageData?.revised_prompt,
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.getZAI();
      return true;
    } catch {
      return false;
    }
  }
}
