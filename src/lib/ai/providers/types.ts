// Z.Design - AI Provider Types
// Core interfaces for the multi-provider AI abstraction layer

// ============ Provider Capability Flags ============

export type ProviderCapability =
  | 'llm-chat'
  | 'llm-streaming'
  | 'image-generation'
  | 'image-understanding'
  | 'speech-to-text'
  | 'text-to-speech';

// ============ Provider Types ============

export type ProviderType = 'zai' | 'openai' | 'anthropic' | 'google' | 'stability' | 'replicate' | 'openrouter' | 'minimax' | 'custom';

// ============ Configuration Interfaces ============

export interface ModelConfig {
  id: string;        // Model identifier (e.g., "gpt-4o", "claude-3.5-sonnet")
  name: string;      // Display name
  type: 'llm' | 'image' | 'embedding';
  capabilities: ProviderCapability[];
  maxTokens?: number;
  supportsStreaming?: boolean;
  supportsImages?: boolean;
  supportsTools?: boolean;
}

export interface ProviderConfig {
  id: string;
  name: string;
  provider: ProviderType;
  apiKey?: string;
  baseUrl?: string;
  models: ModelConfig[];
  capabilities: ProviderCapability[];
  isActive: boolean;
  priority: number; // Lower = higher priority
  config: Record<string, unknown>; // Provider-specific config
}

// ============ Request/Response Types ============

export interface LLMChatRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface LLMChatResponse {
  content: string;
  model: string;
  provider: ProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface ImageGenRequest {
  prompt: string;
  size?: string;
  style?: string;
  n?: number;
  model?: string;
}

export interface ImageGenResponse {
  url: string;       // Image URL or base64 data URI
  prompt: string;
  size: string;
  model: string;
  provider: ProviderType;
  revisedPrompt?: string;
}

// ============ Provider Adapter Interface ============

export interface AIProviderAdapter {
  readonly type: ProviderType;
  readonly name: string;
  readonly capabilities: ProviderCapability[];

  // LLM chat completion
  chat(request: LLMChatRequest): Promise<LLMChatResponse>;

  // Image generation
  generateImage(request: ImageGenRequest): Promise<ImageGenResponse>;

  // Health check
  isAvailable(): Promise<boolean>;
}

// ============ Rate Limit Tracking ============

export interface RateLimitInfo {
  requestsLimit: number;
  requestsRemaining: number;
  requestsResetAt: Date | null;
  tokensLimit: number;
  tokensRemaining: number;
  tokensResetAt: Date | null;
}

export interface DynamicModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  maxOutputTokens?: number;
  pricing: {
    prompt: number;      // per 1M tokens
    completion: number;  // per 1M tokens
    image?: number;      // per image
  };
  isFree: boolean;
  capabilities: ProviderCapability[];
  modality?: string[];   // e.g., ['text', 'image']
  architecture?: {
    modality: string;
    tokenizer: string;
    instructType: string | null;
  };
}

export interface ProviderWithRateLimits extends AIProviderAdapter {
  fetchModels?(): Promise<DynamicModelInfo[]>;
  getRateLimits?(): RateLimitInfo;
  updateRateLimits?(headers: Headers): void;
}
