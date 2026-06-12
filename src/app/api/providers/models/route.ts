import { NextRequest, NextResponse } from 'next/server';

// ============ Types ============

interface DynamicModelInfo {
  id: string;
  name: string;
  type: 'llm' | 'image' | 'embedding' | 'audio' | 'video';
  capabilities: string[];
  contextLength?: number;
  pricing?: {
    prompt?: number;   // per 1M tokens
    completion?: number; // per 1M tokens
    image?: number;    // per image
  };
  isFree: boolean;
  description?: string;
}

// ============ Provider Model Fetchers ============

async function fetchOpenRouterModels(): Promise<DynamicModelInfo[]> {
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.data || []).map((model: Record<string, unknown>) => {
    const pricing = model.pricing as Record<string, string> | undefined;
    const promptPrice = pricing ? parseFloat(pricing.prompt || '0') : 0;
    const completionPrice = pricing ? parseFloat(pricing.completion || '0') : 0;
    const imagePrice = pricing ? parseFloat(pricing.image || '0') : 0;
    const isFree = promptPrice === 0 && completionPrice === 0 && imagePrice === 0;

    const contextLength = (model.context_length as number) || undefined;

    const capabilities: string[] = [];
    const modelId = (model.id as string).toLowerCase();
    const architecture = model.architecture as Record<string, string> | undefined;

    // Determine type and capabilities from model metadata
    if (architecture?.modality === 'text+image->text' || (modelId.includes('vision')) || (modelId.includes('vl-'))) {
      capabilities.push('llm-chat', 'llm-streaming', 'image-understanding');
    } else if (architecture?.modality === 'text->text' || modelId.includes('gpt') || modelId.includes('claude') || modelId.includes('llama') || modelId.includes('mistral') || modelId.includes('gemini')) {
      capabilities.push('llm-chat', 'llm-streaming');
    }

    if (modelId.includes('dall-e') || modelId.includes('stable-diffusion') || modelId.includes('flux') || modelId.includes('midjourney') || modelId.includes('sdxl')) {
      capabilities.push('image-generation');
    }

    if (modelId.includes('embedding') || modelId.includes('embed')) {
      capabilities.push('embedding');
    }

    if (modelId.includes('tts') || modelId.includes('speech') || modelId.includes('whisper')) {
      capabilities.push('text-to-speech', 'speech-to-text');
    }

    // Default to llm-chat if no capabilities detected
    if (capabilities.length === 0) {
      capabilities.push('llm-chat', 'llm-streaming');
    }

    let type: DynamicModelInfo['type'] = 'llm';
    if (modelId.includes('dall-e') || modelId.includes('stable-diffusion') || modelId.includes('flux') || modelId.includes('sdxl') || modelId.includes('image')) {
      type = 'image';
    } else if (modelId.includes('embedding') || modelId.includes('embed')) {
      type = 'embedding';
    } else if (modelId.includes('tts') || modelId.includes('whisper') || modelId.includes('speech')) {
      type = 'audio';
    } else if (modelId.includes('video')) {
      type = 'video';
    }

    return {
      id: model.id as string,
      name: (model.name as string) || (model.id as string),
      type,
      capabilities,
      contextLength,
      pricing: {
        prompt: promptPrice > 0 ? promptPrice * 1_000_000 : undefined,
        completion: completionPrice > 0 ? completionPrice * 1_000_000 : undefined,
        image: imagePrice > 0 ? imagePrice : undefined,
      },
      isFree,
      description: (model.description as string) || undefined,
    };
  });
}

async function fetchMinimaxModels(): Promise<DynamicModelInfo[]> {
  // Minimax has a static model list - no public model listing API
  return [
    {
      id: 'MiniMax-Text-01',
      name: 'MiniMax-Text-01',
      type: 'llm',
      capabilities: ['llm-chat', 'llm-streaming'],
      contextLength: 1_000_000,
      isFree: false,
      description: 'MiniMax flagship text model with 1M context',
    },
    {
      id: 'MiniMax-M1',
      name: 'MiniMax-M1',
      type: 'llm',
      capabilities: ['llm-chat', 'llm-streaming'],
      contextLength: 1_000_000,
      isFree: false,
      description: 'MiniMax M1 reasoning model',
    },
    {
      id: 'abab6.5s-chat',
      name: 'ABAB 6.5s Chat',
      type: 'llm',
      capabilities: ['llm-chat', 'llm-streaming'],
      contextLength: 245_000,
      isFree: false,
      description: 'ABAB 6.5s chat model',
    },
    {
      id: 'abab6.5-chat',
      name: 'ABAB 6.5 Chat',
      type: 'llm',
      capabilities: ['llm-chat', 'llm-streaming'],
      contextLength: 16_000,
      isFree: false,
      description: 'ABAB 6.5 chat model',
    },
    {
      id: 'abab6.5t-chat',
      name: 'ABAB 6.5t Chat',
      type: 'llm',
      capabilities: ['llm-chat', 'llm-streaming'],
      contextLength: 16_000,
      isFree: false,
      description: 'ABAB 6.5t chat model',
    },
    {
      id: 'video-01',
      name: 'Video-01',
      type: 'video',
      capabilities: ['image-generation'],
      isFree: false,
      description: 'MiniMax video generation model',
    },
    {
      id: 'video-01-live2d',
      name: 'Video-01-Live2D',
      type: 'video',
      capabilities: ['image-generation'],
      isFree: false,
      description: 'MiniMax Live2D video generation model',
    },
    {
      id: 'speech-01-turbo',
      name: 'Speech-01-Turbo',
      type: 'audio',
      capabilities: ['text-to-speech'],
      isFree: false,
      description: 'MiniMax TTS model',
    },
    {
      id: 'speech-01',
      name: 'Speech-01',
      type: 'audio',
      capabilities: ['text-to-speech'],
      isFree: false,
      description: 'MiniMax TTS model',
    },
  ];
}

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<DynamicModelInfo[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAI-compatible API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();

  return (data.data || []).map((model: Record<string, unknown>) => {
    const modelId = (model.id as string).toLowerCase();
    const capabilities: string[] = [];
    let type: DynamicModelInfo['type'] = 'llm';

    // Determine capabilities from model ID patterns
    if (modelId.includes('gpt-4o') || modelId.includes('gpt-4-turbo') || modelId.includes('o1') || modelId.includes('o3') || modelId.includes('o4')) {
      capabilities.push('llm-chat', 'llm-streaming', 'image-understanding');
    } else if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5') || modelId.includes('chatgpt')) {
      capabilities.push('llm-chat', 'llm-streaming');
    } else if (modelId.includes('dall-e')) {
      capabilities.push('image-generation');
      type = 'image';
    } else if (modelId.includes('whisper')) {
      capabilities.push('speech-to-text');
      type = 'audio';
    } else if (modelId.includes('tts')) {
      capabilities.push('text-to-speech');
      type = 'audio';
    } else if (modelId.includes('embedding') || modelId.includes('text-embedding')) {
      capabilities.push('embedding');
      type = 'embedding';
    } else if (modelId.includes('davinci') || modelId.includes('babbage') || modelId.includes('curie') || modelId.includes('ada')) {
      capabilities.push('llm-chat');
    } else {
      capabilities.push('llm-chat', 'llm-streaming');
    }

    // Determine context length from known model patterns
    let contextLength: number | undefined;
    if (modelId.includes('gpt-4o') && !modelId.includes('mini')) contextLength = 128_000;
    else if (modelId.includes('gpt-4o-mini')) contextLength = 128_000;
    else if (modelId.includes('gpt-4-turbo')) contextLength = 128_000;
    else if (modelId.includes('gpt-4-32k')) contextLength = 32_768;
    else if (modelId.includes('gpt-4')) contextLength = 8_192;
    else if (modelId.includes('gpt-3.5-turbo-16k')) contextLength = 16_384;
    else if (modelId.includes('gpt-3.5-turbo')) contextLength = 4_096;
    else if (modelId.includes('o1-preview')) contextLength = 128_000;
    else if (modelId.includes('o1-mini')) contextLength = 128_000;
    else if (modelId.includes('o1')) contextLength = 200_000;
    else if (modelId.includes('o3')) contextLength = 200_000;
    else if (modelId.includes('o4')) contextLength = 200_000;

    return {
      id: model.id as string,
      name: (model.id as string),
      type,
      capabilities,
      contextLength,
      isFree: false,
    };
  });
}

// ============ GET Handler ============

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');
    const apiKey = searchParams.get('apiKey');
    const baseUrl = searchParams.get('baseUrl') || 'https://api.openai.com/v1';

    if (!provider) {
      return NextResponse.json(
        { error: 'provider query parameter is required' },
        { status: 400 }
      );
    }

    let models: DynamicModelInfo[] = [];

    switch (provider) {
      case 'openrouter': {
        models = await fetchOpenRouterModels();
        break;
      }
      case 'minimax': {
        models = await fetchMinimaxModels();
        break;
      }
      case 'openai': {
        if (!apiKey) {
          return NextResponse.json(
            { error: 'apiKey is required for OpenAI provider' },
            { status: 400 }
          );
        }
        models = await fetchOpenAIModels(apiKey, baseUrl);
        break;
      }
      case 'anthropic': {
        // Anthropic doesn't have a public models endpoint; return known models
        models = [
          {
            id: 'claude-sonnet-4-20250514',
            name: 'Claude Sonnet 4',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
            contextLength: 200_000,
            isFree: false,
            description: 'Anthropic Claude Sonnet 4 - balanced performance and speed',
          },
          {
            id: 'claude-opus-4-20250514',
            name: 'Claude Opus 4',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
            contextLength: 200_000,
            isFree: false,
            description: 'Anthropic Claude Opus 4 - highest capability',
          },
          {
            id: 'claude-3-5-sonnet-20241022',
            name: 'Claude 3.5 Sonnet',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
            contextLength: 200_000,
            isFree: false,
            description: 'Anthropic Claude 3.5 Sonnet',
          },
          {
            id: 'claude-3-5-haiku-20241022',
            name: 'Claude 3.5 Haiku',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming'],
            contextLength: 200_000,
            isFree: false,
            description: 'Anthropic Claude 3.5 Haiku - fast and affordable',
          },
        ];
        break;
      }
      case 'google': {
        models = [
          {
            id: 'gemini-2.0-flash',
            name: 'Gemini 2.0 Flash',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
            contextLength: 1_048_576,
            isFree: false,
            description: 'Google Gemini 2.0 Flash - fast and versatile',
          },
          {
            id: 'gemini-2.0-flash-lite',
            name: 'Gemini 2.0 Flash Lite',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming'],
            contextLength: 1_048_576,
            isFree: false,
            description: 'Google Gemini 2.0 Flash Lite - cost-effective',
          },
          {
            id: 'gemini-2.5-pro-preview-03-25',
            name: 'Gemini 2.5 Pro',
            type: 'llm',
            capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
            contextLength: 1_048_576,
            isFree: false,
            description: 'Google Gemini 2.5 Pro - highest quality',
          },
        ];
        break;
      }
      case 'stability': {
        models = [
          {
            id: 'stable-diffusion-3.5-large',
            name: 'Stable Diffusion 3.5 Large',
            type: 'image',
            capabilities: ['image-generation'],
            isFree: false,
            description: 'Stability AI SD 3.5 Large',
          },
          {
            id: 'stable-diffusion-3.5-medium',
            name: 'Stable Diffusion 3.5 Medium',
            type: 'image',
            capabilities: ['image-generation'],
            isFree: false,
            description: 'Stability AI SD 3.5 Medium',
          },
          {
            id: 'stable-image-ultra',
            name: 'Stable Image Ultra',
            type: 'image',
            capabilities: ['image-generation'],
            isFree: false,
            description: 'Stability AI Stable Image Ultra',
          },
        ];
        break;
      }
      default: {
        return NextResponse.json(
          { error: `Unsupported provider: ${provider}. Supported: openrouter, minimax, openai, anthropic, google, stability` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ models, provider });
  } catch (error) {
    console.error('[Providers Models API] GET Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch models';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
