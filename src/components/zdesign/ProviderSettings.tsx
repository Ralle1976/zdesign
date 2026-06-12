'use client';

import { useState, useCallback } from 'react';
import { useZDesignStore, BUILT_IN_PROVIDERS } from '@/stores/zdesign-store';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings2,
  Check,
  AlertTriangle,
  MessageSquare,
  ImageIcon,
  Eye,
  Code,
  Key,
  Cpu,
  ChevronDown,
  Shield,
  Sparkles,
  Zap,
  Loader2,
  XCircle,
  CheckCircle2,
} from 'lucide-react';
import type { AIProviderConfig, AIModelConfig, ProviderCapability } from '@/types/design';

interface ProviderSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ============ Capability Badge Helpers ============

const CAPABILITY_CONFIG: Record<ProviderCapability, { label: { en: string; de: string }; icon: typeof MessageSquare; color: string }> = {
  text: { label: { en: 'Text Generation', de: 'Textgenerierung' }, icon: MessageSquare, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  image: { label: { en: 'Image Generation', de: 'Bildgenerierung' }, icon: ImageIcon, color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
  vision: { label: { en: 'Vision / Image Analysis', de: 'Sehen / Bildanalyse' }, icon: Eye, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400' },
  code: { label: { en: 'Code Generation', de: 'Codegenerierung' }, icon: Code, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

function CapabilityBadge({ capability }: { capability: ProviderCapability }) {
  const config = CAPABILITY_CONFIG[capability];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 gap-1 border-0 ${config.color}`}>
      <Icon className="size-3" />
      {config.label.en}
    </Badge>
  );
}

function CapabilityCheck({ capability, available }: { capability: ProviderCapability; available: boolean }) {
  const config = CAPABILITY_CONFIG[capability];
  const Icon = config.icon;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={`flex items-center justify-center size-6 rounded-md ${available ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'}`}>
        {available ? (
          <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <AlertTriangle className="size-3.5 text-muted-foreground" />
        )}
      </div>
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-sm">{config.label.en}</span>
      <span className={`text-xs ml-auto ${available ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
        {available ? 'Available' : 'Not configured'}
      </span>
    </div>
  );
}

// ============ Verification State ============

interface VerificationResult {
  success: boolean;
  capabilities: string[];
  message: string;
}

// ============ Provider Card ============

function ProviderCard({
  provider,
  isActive,
  onSelect,
  verificationState,
  onVerify,
}: {
  provider: AIProviderConfig;
  isActive: boolean;
  onSelect: () => void;
  verificationState: { loading: boolean; result: VerificationResult | null };
  onVerify: () => void;
}) {
  const isAvailable = provider.isAvailable || provider.isDefault;
  const locale = useZDesignStore((s) => s.locale);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
        isActive
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10 shadow-sm'
          : 'border-border hover:border-emerald-300 dark:hover:border-emerald-800 bg-card'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate">{provider.name}</h4>
            {provider.isDefault && (
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                Default
              </Badge>
            )}
            {!isAvailable && (
              <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                API Key Required
              </Badge>
            )}
            {/* Verification result indicator */}
            {verificationState.result && (
              verificationState.result.success ? (
                <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-0.5">
                  <CheckCircle2 className="size-2.5" />
                  Verified
                </Badge>
              ) : (
                <Badge className="text-[9px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0 gap-0.5">
                  <XCircle className="size-2.5" />
                  Failed
                </Badge>
              )
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{provider.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {/* Show verified capabilities if available, otherwise show declared ones */}
            {(verificationState.result?.success ? verificationState.result.capabilities as ProviderCapability[] : provider.capabilities).map((cap) => (
              <CapabilityBadge key={cap} capability={cap} />
            ))}
          </div>
          {/* Verification message */}
          {verificationState.result && (
            <p className={`text-[11px] mt-1.5 ${verificationState.result.success ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {verificationState.result.message}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0 mt-0.5">
          <div className={`flex items-center justify-center size-5 rounded-full border-2 ${
            isActive ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
          }`}>
            {isActive && <Check className="size-3 text-white" />}
          </div>
          {/* Verify button */}
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onVerify();
              }}
              disabled={verificationState.loading}
            >
              {verificationState.loading ? (
                <>
                  <Loader2 className="size-2.5 animate-spin" />
                  Checking...
                </>
              ) : verificationState.result?.success ? (
                <>
                  <CheckCircle2 className="size-2.5 text-emerald-600 dark:text-emerald-400" />
                  Verified
                </>
              ) : (
                <>
                  <Shield className="size-2.5" />
                  Verify
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </button>
  );
}

// ============ Model Selector ============

function ModelSelector({
  provider,
  activeModelId,
  onSelectModel,
}: {
  provider: AIProviderConfig;
  activeModelId: string;
  onSelectModel: (modelId: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Cpu className="size-4 text-muted-foreground" />
        Model Selection
      </h4>
      <div className="space-y-1.5">
        {provider.models.map((model) => {
          const isActive = activeModelId === model.id;
          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelectModel(model.id)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                isActive
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10'
                  : 'border-border hover:border-emerald-300 dark:hover:border-emerald-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">{model.name}</span>
                  {model.isDefault && (
                    <Badge className="text-[9px] px-1.5 py-0 ml-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                      Recommended
                    </Badge>
                  )}
                </div>
                <div className={`flex items-center justify-center size-5 rounded-full border-2 shrink-0 ${
                  isActive ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground/30'
                }`}>
                  {isActive && <Check className="size-3 text-white" />}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{model.description}</p>
              <div className="flex items-center gap-2 mt-2">
                {model.capabilities.map((cap) => (
                  <CapabilityBadge key={cap} capability={cap} />
                ))}
                {model.maxTokens && (
                  <span className="text-[10px] text-muted-foreground">
                    {model.maxTokens >= 1000000
                      ? `${(model.maxTokens / 1000000).toFixed(0)}M tokens`
                      : model.maxTokens >= 1000
                        ? `${(model.maxTokens / 1000).toFixed(0)}K tokens`
                        : `${model.maxTokens} tokens`}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ Main Component ============

export function ProviderSettings({ open, onOpenChange }: ProviderSettingsProps) {
  const { t } = useI18n();
  const activeProviderId = useZDesignStore((s) => s.activeProviderId);
  const activeModelId = useZDesignStore((s) => s.activeModelId);
  const setActiveProvider = useZDesignStore((s) => s.setActiveProvider);
  const setActiveModel = useZDesignStore((s) => s.setActiveModel);
  const providerApiKey = useZDesignStore((s) => s.providerApiKey);
  const setProviderApiKey = useZDesignStore((s) => s.setProviderApiKey);
  const hasCapability = useZDesignStore((s) => s.hasCapability);

  const activeProvider = BUILT_IN_PROVIDERS.find((p) => p.id === activeProviderId);

  const [apiKeyInput, setApiKeyInput] = useState<Record<string, string>>({});
  const [verificationStates, setVerificationStates] = useState<Record<string, { loading: boolean; result: VerificationResult | null }>>({});

  const handleProviderSelect = useCallback((providerId: string) => {
    setActiveProvider(providerId);
  }, [setActiveProvider]);

  const handleModelSelect = useCallback((modelId: string) => {
    setActiveModel(modelId);
  }, [setActiveModel]);

  const handleSaveApiKey = useCallback((providerId: string) => {
    const key = apiKeyInput[providerId]?.trim();
    if (key) {
      setProviderApiKey(providerId, key);
    }
  }, [apiKeyInput, setProviderApiKey]);

  const handleVerifyProvider = useCallback(async (providerId: string) => {
    setVerificationStates((prev) => ({
      ...prev,
      [providerId]: { loading: true, result: null },
    }));

    try {
      const res = await fetch('/api/providers/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          apiKey: providerApiKey[providerId] || undefined,
          modelId: activeModelId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setVerificationStates((prev) => ({
          ...prev,
          [providerId]: {
            loading: false,
            result: {
              success: data.success,
              capabilities: data.capabilities || [],
              message: data.message || (data.success ? 'Connection verified' : 'Verification failed'),
            },
          },
        }));
      } else {
        setVerificationStates((prev) => ({
          ...prev,
          [providerId]: {
            loading: false,
            result: {
              success: false,
              capabilities: [],
              message: 'Verification request failed',
            },
          },
        }));
      }
    } catch {
      setVerificationStates((prev) => ({
        ...prev,
        [providerId]: {
          loading: false,
          result: {
            success: false,
            capabilities: [],
            message: 'Network error during verification',
          },
        },
      }));
    }
  }, [providerApiKey, activeModelId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="flex items-center justify-center size-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Settings2 className="size-4" />
            </div>
            AI Provider Settings
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Configure AI providers and models for design generation. Each provider has different capabilities.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="providers" className="flex-1 flex flex-col min-h-0">
          <div className="px-6">
            <TabsList className="w-full">
              <TabsTrigger value="providers" className="flex-1 gap-1.5">
                <Cpu className="size-3.5" />
                Providers
              </TabsTrigger>
              <TabsTrigger value="capabilities" className="flex-1 gap-1.5">
                <Shield className="size-3.5" />
                Capabilities
              </TabsTrigger>
              <TabsTrigger value="apikeys" className="flex-1 gap-1.5">
                <Key className="size-3.5" />
                API Keys
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            {/* ============ PROVIDERS TAB ============ */}
            <TabsContent value="providers" className="p-6 pt-4 space-y-4 mt-0">
              <p className="text-xs text-muted-foreground">
                Select a provider and model for AI-powered design generation. The active provider determines which capabilities are available.
              </p>

              {/* Provider Selection */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Select Provider</h4>
                <div className="grid gap-2">
                  {BUILT_IN_PROVIDERS.map((provider) => (
                    <ProviderCard
                      key={provider.id}
                      provider={provider}
                      isActive={activeProviderId === provider.id}
                      onSelect={() => handleProviderSelect(provider.id)}
                      verificationState={verificationStates[provider.id] || { loading: false, result: null }}
                      onVerify={() => handleVerifyProvider(provider.id)}
                    />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Model Selection */}
              {activeProvider && (
                <ModelSelector
                  provider={activeProvider}
                  activeModelId={activeModelId}
                  onSelectModel={handleModelSelect}
                />
              )}

              {/* Active Configuration Summary */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active Configuration</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Provider:</span>
                    <span className="ml-2 font-medium">{activeProvider?.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Model:</span>
                    <span className="ml-2 font-medium">{activeProvider?.models.find(m => m.id === activeModelId)?.name || 'Unknown'}</span>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {(['text', 'image', 'vision', 'code'] as ProviderCapability[]).map((cap) => (
                    <span
                      key={cap}
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        hasCapability(cap)
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                      }`}
                    >
                      {hasCapability(cap) ? '✓' : '✗'} {cap}
                    </span>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ============ CAPABILITIES TAB ============ */}
            <TabsContent value="capabilities" className="p-6 pt-4 space-y-4 mt-0">
              <p className="text-xs text-muted-foreground">
                Check which capabilities are available with your current provider/model combination. Required capabilities for each feature are shown below.
              </p>

              {/* Current Capabilities */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Shield className="size-4 text-emerald-500" />
                  Current Capabilities
                </h4>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  {(['text', 'image', 'vision', 'code'] as ProviderCapability[]).map((cap) => (
                    <CapabilityCheck key={cap} capability={cap} available={hasCapability(cap)} />
                  ))}
                </div>
              </div>

              <Separator />

              {/* Feature Requirements */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-500" />
                  Feature Requirements
                </h4>
                <div className="space-y-2">
                  {[
                    { feature: 'Design Generation', icon: Sparkles, required: ['text'] as ProviderCapability[], desc: 'Generate designs from text descriptions' },
                    { feature: 'Design Modification', icon: MessageSquare, required: ['text'] as ProviderCapability[], desc: 'Modify existing designs via chat' },
                    { feature: 'AI Image Generation', icon: ImageIcon, required: ['image'] as ProviderCapability[], desc: 'Generate images from descriptions' },
                    { feature: 'Design Analysis (VLM)', icon: Eye, required: ['vision'] as ProviderCapability[], desc: 'Analyze screenshots and extract tokens' },
                    { feature: 'Code Export', icon: Code, required: ['text'] as ProviderCapability[], desc: 'Generate HTML/React/Next.js code' },
                    { feature: 'Creative Mode', icon: Zap, required: ['text'] as ProviderCapability[], desc: 'Multi-pass creative generation' },
                  ].map((item) => {
                    const Icon = item.icon;
                    const allAvailable = item.required.every((cap) => hasCapability(cap));
                    return (
                      <div key={item.feature} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <div className={`flex items-center justify-center size-8 rounded-lg ${allAvailable ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                          <Icon className={`size-4 ${allAvailable ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{item.feature}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${allAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                              {allAvailable ? 'Available' : 'Missing capability'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                          <div className="flex gap-1 mt-1">
                            <span className="text-[10px] text-muted-foreground">Requires:</span>
                            {item.required.map((cap) => (
                              <span key={cap} className={`text-[10px] px-1.5 py-0 rounded ${
                                hasCapability(cap)
                                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                  : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                              }`}>
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>

            {/* ============ API KEYS TAB ============ */}
            <TabsContent value="apikeys" className="p-6 pt-4 space-y-4 mt-0">
              <p className="text-xs text-muted-foreground">
                Configure API keys for third-party providers. The default Z.ai provider works without an API key.
              </p>

              <div className="space-y-3">
                {BUILT_IN_PROVIDERS.map((provider) => {
                  const hasKey = !!providerApiKey[provider.id];
                  const isDefault = provider.isDefault;
                  return (
                    <div key={provider.id} className="p-4 rounded-xl border bg-card space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-medium">{provider.name}</h4>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                        {isDefault ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                            No key needed
                          </Badge>
                        ) : hasKey ? (
                          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                            ✓ Key set
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                            Key required
                          </Badge>
                        )}
                      </div>

                      {!isDefault && (
                        <div className="flex gap-2">
                          <Input
                            type="password"
                            placeholder={`Enter ${provider.name} API key...`}
                            value={apiKeyInput[provider.id] || ''}
                            onChange={(e) =>
                              setApiKeyInput((prev) => ({
                                ...prev,
                                [provider.id]: e.target.value,
                              }))
                            }
                            className="text-sm h-9"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSaveApiKey(provider.id)}
                            disabled={!apiKeyInput[provider.id]?.trim()}
                            className="shrink-0"
                          >
                            Save
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-start gap-2">
                  <Shield className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">Security Notice</p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      API keys are stored locally in your browser session. They are never sent to our servers. Keys are used only for direct API calls to the respective provider.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
