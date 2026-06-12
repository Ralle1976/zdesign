'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings2,
  Key,
  Globe,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  MessageSquare,
  ImageIcon,
  Eye,
  Mic,
  Volume2,
  Trash2,
  Plus,
  Zap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Shield,
  AlertTriangle,
  RotateCw,
  Brain,
  Cpu,
  X,
  Search,
  EyeOff,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useI18n } from '@/i18n';

// ============ Types ============

interface DynamicModelInfo {
  id: string;
  name: string;
  type: string;
  description?: string;
  contextLength?: number;
  maxOutputTokens?: number;
  pricing?: {
    prompt?: number;
    completion?: number;
    image?: number;
  };
  isFree: boolean;
  capabilities: string[];
  modality?: string[];
}

interface RateLimitInfo {
  requestsUsed: number;
  requestsLimit: number;
  requestsRemaining: number;
  tokensUsed: number;
  tokensLimit: number;
  tokensRemaining: number;
  isRateLimited: boolean;
  lastError?: string | null;
  requestsResetAt?: string | null;
  tokensResetAt?: string | null;
}

interface ProviderInfo {
  id: string;
  name: string;
  provider: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  models: Array<{ id: string; name: string; type: string; capabilities: string[] }>;
  capabilities: string[];
  isActive: boolean;
  priority: number;
  // Rate limit fields
  requestsUsed?: number;
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensUsed?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  isRateLimited?: boolean;
  lastError?: string | null;
  requestsResetAt?: string | null;
  tokensResetAt?: string | null;
  lastUsedAt?: string | null;
}

// ============ Constants ============

const CAPABILITY_ICONS: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  'llm-chat': { icon: MessageSquare, label: 'Chat', color: 'text-emerald-500' },
  'llm-streaming': { icon: Zap, label: 'Streaming', color: 'text-teal-500' },
  'image-generation': { icon: ImageIcon, label: 'Image Gen', color: 'text-amber-500' },
  'image-understanding': { icon: Eye, label: 'Vision', color: 'text-orange-500' },
  'speech-to-text': { icon: Mic, label: 'STT', color: 'text-rose-500' },
  'text-to-speech': { icon: Volume2, label: 'TTS', color: 'text-cyan-500' },
  'embedding': { icon: Brain, label: 'Embedding', color: 'text-violet-500' },
};

const PROVIDER_PRESETS = [
  {
    name: 'Z.ai',
    provider: 'zai',
    baseUrl: '',
    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding', 'speech-to-text', 'text-to-speech'],
    models: [
      { id: 'zai-default', name: 'Z.ai Default', type: 'llm', capabilities: ['llm-chat', 'llm-streaming'] },
      { id: 'zai-image', name: 'Z.ai Image', type: 'image', capabilities: ['image-generation'] },
    ],
    isBuiltIn: true,
    icon: Sparkles,
    gradient: 'from-emerald-500 to-teal-600',
    description: 'Built-in AI provider - always available',
  },
  {
    name: 'OpenRouter',
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding'],
    models: [],
    isBuiltIn: false,
    icon: Globe,
    gradient: 'from-teal-500 to-emerald-600',
    description: 'Access 200+ models from multiple providers',
    supportsDynamicModels: true,
  },
  {
    name: 'Minimax',
    provider: 'minimax',
    baseUrl: 'https://api.minimax.chat/v1',
    capabilities: ['llm-chat', 'llm-streaming', 'text-to-speech', 'image-generation'],
    models: [],
    isBuiltIn: false,
    icon: Cpu,
    gradient: 'from-cyan-500 to-teal-600',
    description: 'Chinese AI with 1M context and TTS',
    supportsDynamicModels: true,
  },
  {
    name: 'OpenAI',
    provider: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding', 'speech-to-text', 'text-to-speech'],
    models: [],
    isBuiltIn: false,
    icon: Brain,
    gradient: 'from-emerald-600 to-green-700',
    description: 'GPT-4o, DALL-E, Whisper, TTS',
    supportsDynamicModels: true,
  },
  {
    name: 'Anthropic Claude',
    provider: 'anthropic',
    baseUrl: '',
    capabilities: ['llm-chat', 'llm-streaming', 'image-understanding'],
    models: [],
    isBuiltIn: false,
    icon: Shield,
    gradient: 'from-amber-500 to-orange-600',
    description: 'Claude Sonnet 4, Opus 4, Haiku',
  },
  {
    name: 'Google AI',
    provider: 'google',
    baseUrl: 'https://generativelanguage.googleapis.com/v1',
    capabilities: ['llm-chat', 'llm-streaming', 'image-understanding', 'image-generation'],
    models: [],
    isBuiltIn: false,
    icon: Sparkles,
    gradient: 'from-emerald-400 to-cyan-600',
    description: 'Gemini Pro, Flash, Ultra',
  },
  {
    name: 'Stability AI',
    provider: 'stability',
    baseUrl: 'https://api.stability.ai/v1',
    capabilities: ['image-generation'],
    models: [],
    isBuiltIn: false,
    icon: ImageIcon,
    gradient: 'from-rose-500 to-pink-600',
    description: 'Stable Diffusion 3.5, SDXL',
  },
  {
    name: 'Custom',
    provider: 'custom',
    baseUrl: '',
    capabilities: ['llm-chat'],
    models: [],
    isBuiltIn: false,
    icon: Settings2,
    gradient: 'from-gray-500 to-gray-600',
    description: 'Any OpenAI-compatible API endpoint',
  },
];

// ============ Helper Functions ============

function getRateLimitColor(used: number, limit: number): string {
  if (limit <= 0) return 'bg-muted-foreground/30';
  const pct = used / limit;
  if (pct > 0.75) return 'bg-red-500';
  if (pct > 0.5) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getRateLimitTextColor(used: number, limit: number): string {
  if (limit <= 0) return 'text-muted-foreground';
  const pct = used / limit;
  if (pct > 0.75) return 'text-red-600 dark:text-red-400';
  if (pct > 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatResetTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Reset available';
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Resets in ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  return `Resets in ${diffHr}h ${diffMin % 60}m`;
}

function formatContextLength(ctx?: number): string {
  if (!ctx) return '-';
  if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(0)}M`;
  if (ctx >= 1_000) return `${(ctx / 1_000).toFixed(0)}K`;
  return ctx.toString();
}

function formatPricing(pricing?: DynamicModelInfo['pricing']): string {
  if (!pricing) return '-';
  const parts: string[] = [];
  if (pricing.prompt && pricing.prompt > 0) {
    parts.push(`In: $${pricing.prompt.toFixed(2)}/M`);
  }
  if (pricing.completion && pricing.completion > 0) {
    parts.push(`Out: $${pricing.completion.toFixed(2)}/M`);
  }
  if (parts.length === 0) return '-';
  return parts.join(' · ');
}

// ============ Main Component ============

export function ProviderSettingsDialog() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message?: string }>>({});
  const [activeTab, setActiveTab] = useState('providers');
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [autoRotation, setAutoRotation] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(
          (data.providers || []).map((p: Record<string, unknown>) => ({
            ...p,
            models: typeof p.models === 'string' ? JSON.parse(p.models) : p.models || [],
            capabilities: typeof p.capabilities === 'string' ? JSON.parse(p.capabilities) : p.capabilities || [],
          }))
        );
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRateLimits = useCallback(async () => {
    try {
      const res = await fetch('/api/providers/rate-limits');
      if (res.ok) {
        const data = await res.json();
        setRateLimits(data.providers || []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchProviders();
      fetchRateLimits();
    }
  }, [open, fetchProviders, fetchRateLimits]);

  const handleToggle = useCallback(
    async (id: string, isActive: boolean) => {
      try {
        const res = await fetch('/api/providers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, isActive }),
        });
        if (res.ok) {
          fetchProviders();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Failed to toggle provider');
        }
      } catch {
        toast.error('Failed to update provider');
      }
    },
    [fetchProviders]
  );

  const handleTest = useCallback(async (id: string, providerType?: string) => {
    if (id === 'zai-default' || providerType === 'zai') {
      setTestResults((prev) => ({ ...prev, [id]: { success: true, message: 'Built-in provider - always connected' } }));
      return;
    }
    setTestingId(id);
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: id }),
      });
      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [id]: { success: data.success === true, message: data.message } }));
      if (data.success) {
        toast.success(`Connection to provider successful!`);
      } else {
        toast.error(data.message || 'Connection test failed');
      }
    } catch {
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: 'Network error' } }));
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await fetch(`/api/providers?id=${id}`, { method: 'DELETE' });
        toast.success('Provider deleted');
        fetchProviders();
        fetchRateLimits();
      } catch {
        toast.error('Failed to delete provider');
      }
    },
    [fetchProviders, fetchRateLimits]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Merge rate limit data with providers
  const mergedProviders = useMemo(() => {
    const rlMap = new Map(rateLimits.map((rl) => [rl.id, rl]));
    return providers.map((p) => {
      const rl = rlMap.get(p.id);
      return rl ? { ...p, ...rl } : p;
    });
  }, [providers, rateLimits]);

  // Compute stats
  const activeCount = mergedProviders.filter((p) => p.isActive).length + 1; // +1 for Z.ai
  const rateLimitedCount = mergedProviders.filter((p) => p.isRateLimited).length;
  const totalProviders = mergedProviders.length + 1;

  // Filter providers
  const filteredProviders = useMemo(() => {
    if (!searchQuery) return mergedProviders;
    const q = searchQuery.toLowerCase();
    return mergedProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.provider.toLowerCase().includes(q) ||
        p.capabilities?.some((c) => c.toLowerCase().includes(q))
    );
  }, [mergedProviders, searchQuery]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <Settings2 className="size-3.5" />
          <span className="hidden lg:inline">{t.nav?.providers || 'Providers'}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-[95vw] w-full max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">AI Provider Settings</DialogTitle>

        {/* Header */}
        <div className="flex flex-col border-b bg-background px-6 py-4 gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                <Settings2 className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">AI Providers</h2>
                <p className="text-sm text-muted-foreground">
                  {loading ? 'Loading...' : `${totalProviders} providers · ${activeCount} active`}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 h-[calc(90vh-180px)]">
          <div className="px-6 pt-3 border-b">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="providers" className="gap-1.5">
                <Cpu className="size-3.5" />
                Providers
              </TabsTrigger>
              <TabsTrigger value="add" className="gap-1.5">
                <Plus className="size-3.5" />
                Add Provider
              </TabsTrigger>
              <TabsTrigger value="limits" className="gap-1.5">
                <AlertTriangle className="size-3.5" />
                Rate Limits
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Providers Tab */}
          <TabsContent value="providers" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-3">
                {/* Z.ai built-in card */}
                <ProviderCard
                  provider={{
                    id: 'zai-default',
                    name: 'Z.ai',
                    provider: 'zai',
                    capabilities: ['llm-chat', 'llm-streaming', 'image-generation', 'image-understanding', 'speech-to-text', 'text-to-speech'],
                    models: [
                      { id: 'zai-default', name: 'Z.ai Default', type: 'llm', capabilities: ['llm-chat', 'llm-streaming'] },
                      { id: 'zai-image', name: 'Z.ai Image', type: 'image', capabilities: ['image-generation'] },
                    ],
                    isActive: true,
                    priority: 0,
                    isRateLimited: false,
                  }}
                  isBuiltIn
                  testResult={testResults['zai-default']}
                  isTesting={testingId === 'zai-default'}
                  onTest={() => handleTest('zai-default', 'zai')}
                  isExpanded={expandedProviders.has('zai-default')}
                  onToggleExpand={() => toggleExpand('zai-default')}
                />

                {filteredProviders
                  .filter((p) => p.provider !== 'zai')
                  .map((p) => (
                    <ProviderCard
                      key={p.id}
                      provider={p}
                      testResult={testResults[p.id]}
                      isTesting={testingId === p.id}
                      onToggle={(isActive) => handleToggle(p.id, isActive)}
                      onTest={() => handleTest(p.id)}
                      onDelete={() => handleDelete(p.id)}
                      onUpdateProvider={fetchProviders}
                      isExpanded={expandedProviders.has(p.id)}
                      onToggleExpand={() => toggleExpand(p.id)}
                    />
                  ))}

                {loading && (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="size-6 animate-spin text-emerald-500" />
                  </div>
                )}

                {!loading && filteredProviders.filter((p) => p.provider !== 'zai').length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
                      <Globe className="size-7 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {searchQuery ? 'No providers match your search' : 'No additional providers configured'}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setActiveTab('add')}
                    >
                      <Plus className="size-3.5" />
                      Add Provider
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Add Provider Tab */}
          <TabsContent value="add" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-6">
                <AddProviderSection
                  existingProviders={providers}
                  onProviderAdded={() => {
                    fetchProviders();
                    fetchRateLimits();
                    setActiveTab('providers');
                  }}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Rate Limits Tab */}
          <TabsContent value="limits" className="flex-1 overflow-hidden m-0">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                <RateLimitsOverview
                  providers={mergedProviders}
                  onRefresh={fetchRateLimits}
                />
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Bottom Status Bar */}
        <div className="border-t bg-muted/30 px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span className="text-muted-foreground">{activeCount} active</span>
            </span>
            {rateLimitedCount > 0 && (
              <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3.5" />
                {rateLimitedCount} rate limited
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">Auto-rotation:</span>
            <div className="flex items-center gap-1.5">
              <Switch
                checked={autoRotation}
                onCheckedChange={setAutoRotation}
                className="scale-75"
              />
              <span className={autoRotation ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                {autoRotation ? 'ON' : 'OFF'}
              </span>
            </div>
            {autoRotation && rateLimitedCount > 0 && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 animate-pulse">
                <RotateCw className="size-3 animate-spin" />
                Rotating to next provider...
              </span>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============ Provider Card Component ============

function ProviderCard({
  provider,
  isBuiltIn = false,
  testResult,
  isTesting,
  onToggle,
  onTest,
  onDelete,
  onUpdateProvider,
  isExpanded,
  onToggleExpand,
}: {
  provider: ProviderInfo;
  isBuiltIn?: boolean;
  testResult?: { success: boolean; message?: string };
  isTesting?: boolean;
  onToggle?: (isActive: boolean) => void;
  onTest?: () => void;
  onDelete?: () => void;
  onUpdateProvider?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [showApiKey, setShowApiKey] = useState(false);
  const [editApiKey, setEditApiKey] = useState('');
  const [editBaseUrl, setEditBaseUrl] = useState(provider.baseUrl || '');
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [showUrlEditor, setShowUrlEditor] = useState(false);
  const [saving, setSaving] = useState(false);

  const preset = PROVIDER_PRESETS.find((p) => p.provider === provider.provider);
  const gradient = preset?.gradient || 'from-gray-500 to-gray-600';
  const IconComponent = preset?.icon || Settings2;

  // Status determination
  const getStatus = () => {
    if (isBuiltIn) return { label: 'Connected', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 };
    if (provider.isRateLimited) return { label: 'Rate Limited', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon: AlertTriangle };
    if (!provider.apiKey && !isBuiltIn) return { label: 'Not Configured', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: XCircle };
    if (provider.isActive) return { label: 'Connected', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon: CheckCircle2 };
    return { label: 'Inactive', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: XCircle };
  };
  const status = getStatus();
  const StatusIcon = status.icon;

  const handleSaveApiKey = useCallback(async () => {
    if (!editApiKey.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, apiKey: editApiKey }),
      });
      toast.success('API key updated');
      setShowKeyEditor(false);
      setEditApiKey('');
      onUpdateProvider?.();
    } catch {
      toast.error('Failed to update API key');
    } finally {
      setSaving(false);
    }
  }, [editApiKey, provider.id, onUpdateProvider]);

  const handleSaveBaseUrl = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: provider.id, baseUrl: editBaseUrl }),
      });
      toast.success('Base URL updated');
      setShowUrlEditor(false);
      onUpdateProvider?.();
    } catch {
      toast.error('Failed to update base URL');
    } finally {
      setSaving(false);
    }
  }, [editBaseUrl, provider.id, onUpdateProvider]);

  const hasRateLimitData = (provider.requestsLimit && provider.requestsLimit > 0) || (provider.tokensLimit && provider.tokensLimit > 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border transition-all overflow-hidden ${
        provider.isActive
          ? 'border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/10'
          : 'border-border bg-card'
      } ${provider.isRateLimited ? 'ring-1 ring-amber-500/40' : ''}`}
    >
      {/* Card Header */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`flex items-center justify-center size-10 rounded-xl bg-gradient-to-br ${gradient} text-white shadow-sm shrink-0`}>
            <IconComponent className="size-5" />
          </div>

          {/* Name + Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">{provider.name}</span>
              <Badge variant="secondary" className={`text-[10px] gap-1 ${status.color}`}>
                <StatusIcon className="size-3" />
                {status.label}
              </Badge>
              {isBuiltIn && (
                <Badge variant="secondary" className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                  Built-in
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px]">
                {provider.provider}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Cpu className="size-3" />
                {provider.models?.length || 0} models
              </span>
              {provider.capabilities?.slice(0, 3).map((cap) => {
                const capInfo = CAPABILITY_ICONS[cap];
                return capInfo ? (
                  <span key={cap} className="flex items-center gap-0.5">
                    <capInfo.icon className={`size-3 ${capInfo.color}`} />
                  </span>
                ) : null;
              })}
            </div>
          </div>

          {/* Right side: Switch + Expand */}
          <div className="flex items-center gap-2 shrink-0">
            {!isBuiltIn && onToggle && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch checked={provider.isActive} onCheckedChange={onToggle} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{provider.isActive ? 'Active' : 'Inactive'}</TooltipContent>
              </Tooltip>
            )}
            {testResult && (
              testResult.success ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Tooltip>
                  <TooltipTrigger>
                    <XCircle className="size-4 text-red-500" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{testResult.message}</TooltipContent>
                </Tooltip>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onToggleExpand}
            >
              <motion.div
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown className="size-4" />
              </motion.div>
            </Button>
          </div>
        </div>

        {/* Rate limit mini-bars (visible when collapsed) */}
        {hasRateLimitData && !isExpanded && (
          <div className="mt-3 space-y-1.5">
            {provider.requestsLimit && provider.requestsLimit > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-12 shrink-0">Requests</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getRateLimitColor(provider.requestsUsed || 0, provider.requestsLimit)}`}
                    style={{ width: `${Math.min(100, ((provider.requestsUsed || 0) / provider.requestsLimit) * 100)}%` }}
                  />
                </div>
                <span className={`w-16 text-right ${getRateLimitTextColor(provider.requestsUsed || 0, provider.requestsLimit)}`}>
                  {provider.requestsUsed || 0}/{provider.requestsLimit}
                </span>
              </div>
            )}
            {provider.tokensLimit && provider.tokensLimit > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground w-12 shrink-0">Tokens</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${getRateLimitColor(provider.tokensUsed || 0, provider.tokensLimit)}`}
                    style={{ width: `${Math.min(100, ((provider.tokensUsed || 0) / provider.tokensLimit) * 100)}%` }}
                  />
                </div>
                <span className={`w-16 text-right ${getRateLimitTextColor(provider.tokensUsed || 0, provider.tokensLimit)}`}>
                  {formatNumber(provider.tokensUsed || 0)}/{formatNumber(provider.tokensLimit)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Last error */}
        {provider.isRateLimited && provider.lastError && !isExpanded && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3 shrink-0 mt-0.5" />
            <span className="line-clamp-1">{provider.lastError}</span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t px-4 pb-4 pt-3 space-y-4">
              {/* API Key */}
              {!isBuiltIn && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Key className="size-3" /> API Key
                  </label>
                  {showKeyEditor ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="sk-..."
                        type="password"
                        value={editApiKey}
                        onChange={(e) => setEditApiKey(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={handleSaveApiKey} disabled={saving}>
                        {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowKeyEditor(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 px-3 rounded-md border bg-muted/30 flex items-center text-xs font-mono">
                        {provider.apiKey ? (
                          <span className="flex items-center gap-1.5">
                            {showApiKey ? provider.apiKey : '••••••••••••••••'}
                            <Button variant="ghost" size="icon" className="size-5 ml-1" onClick={() => setShowApiKey(!showApiKey)}>
                              {showApiKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                            </Button>
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic">Not configured</span>
                        )}
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { setShowKeyEditor(true); setEditApiKey(''); }}>
                        <Key className="size-3" />
                        {provider.apiKey ? 'Update' : 'Set'}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Base URL */}
              {!isBuiltIn && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Globe className="size-3" /> Base URL
                  </label>
                  {showUrlEditor ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://api.example.com/v1"
                        value={editBaseUrl}
                        onChange={(e) => setEditBaseUrl(e.target.value)}
                        className="h-8 text-xs"
                        autoFocus
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={handleSaveBaseUrl} disabled={saving}>
                        {saving ? <Loader2 className="size-3 animate-spin" /> : 'Save'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowUrlEditor(false)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-8 px-3 rounded-md border bg-muted/30 flex items-center text-xs truncate">
                        {provider.baseUrl || <span className="text-muted-foreground italic">Not set</span>}
                      </div>
                      <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={() => { setShowUrlEditor(true); setEditBaseUrl(provider.baseUrl || ''); }}>
                        <Globe className="size-3" />
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Rate Limits Detail */}
              {hasRateLimitData && (
                <div className="space-y-3">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="size-3" /> Rate Limits
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {provider.requestsLimit && provider.requestsLimit > 0 && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Requests</span>
                          <span className={getRateLimitTextColor(provider.requestsUsed || 0, provider.requestsLimit)}>
                            {provider.requestsUsed || 0} / {provider.requestsLimit}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, ((provider.requestsUsed || 0) / provider.requestsLimit) * 100)}
                          className={`h-2 ${getRateLimitColor(provider.requestsUsed || 0, provider.requestsLimit)}`}
                        />
                        {provider.requestsResetAt && (
                          <div className="text-[10px] text-muted-foreground">
                            {formatResetTime(provider.requestsResetAt)}
                          </div>
                        )}
                      </div>
                    )}
                    {provider.tokensLimit && provider.tokensLimit > 0 && (
                      <div className="rounded-lg border p-3 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Tokens</span>
                          <span className={getRateLimitTextColor(provider.tokensUsed || 0, provider.tokensLimit)}>
                            {formatNumber(provider.tokensUsed || 0)} / {formatNumber(provider.tokensLimit)}
                          </span>
                        </div>
                        <Progress
                          value={Math.min(100, ((provider.tokensUsed || 0) / provider.tokensLimit) * 100)}
                          className={`h-2 ${getRateLimitColor(provider.tokensUsed || 0, provider.tokensLimit)}`}
                        />
                        {provider.tokensResetAt && (
                          <div className="text-[10px] text-muted-foreground">
                            {formatResetTime(provider.tokensResetAt)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {provider.lastError && (
                    <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/50 p-2 bg-amber-50/50 dark:bg-amber-900/20">
                      <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                      <span>{provider.lastError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Models List */}
              {provider.models && provider.models.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <Cpu className="size-3" /> Models ({provider.models.length})
                  </label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border">
                    {provider.models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center gap-2 px-3 py-2 text-xs border-b last:border-b-0 hover:bg-muted/30"
                      >
                        <span className="font-mono font-medium flex-1 truncate">{model.id}</span>
                        <span className="text-muted-foreground shrink-0">{model.name}</span>
                        <div className="flex gap-1 shrink-0">
                          {model.capabilities?.slice(0, 2).map((cap) => {
                            const capInfo = CAPABILITY_ICONS[cap];
                            return capInfo ? (
                              <Tooltip key={cap}>
                                <TooltipTrigger>
                                  <capInfo.icon className={`size-3 ${capInfo.color}`} />
                                </TooltipTrigger>
                                <TooltipContent>{capInfo.label}</TooltipContent>
                              </Tooltip>
                            ) : null;
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Capabilities */}
              <div className="flex gap-1.5 flex-wrap">
                {provider.capabilities?.map((cap) => {
                  const capInfo = CAPABILITY_ICONS[cap];
                  return capInfo ? (
                    <Tooltip key={cap}>
                      <TooltipTrigger>
                        <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0.5">
                          <capInfo.icon className={`size-3 ${capInfo.color}`} />
                          {capInfo.label}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>{capInfo.label}</TooltipContent>
                    </Tooltip>
                  ) : null;
                })}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={onTest}
                  disabled={isTesting}
                >
                  {isTesting ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                  Test Connection
                </Button>
                {provider.provider === 'openrouter' && onUpdateProvider && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      toast.info('Refresh models from the "Add Provider" tab');
                    }}
                  >
                    <RefreshCw className="size-3" />
                    Refresh Models
                  </Button>
                )}
                {!isBuiltIn && onDelete && (
                  <div className="ml-auto">
                    <Button variant="ghost" size="sm" className="h-8 text-destructive gap-1.5 text-xs" onClick={onDelete}>
                      <Trash2 className="size-3" />
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============ Add Provider Section ============

function AddProviderSection({
  existingProviders,
  onProviderAdded,
}: {
  existingProviders: ProviderInfo[];
  onProviderAdded: () => void;
}) {
  const [selectedPreset, setSelectedPreset] = useState(PROVIDER_PRESETS[1]); // Default to OpenRouter
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [dynamicModels, setDynamicModels] = useState<DynamicModelInfo[]>([]);
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Check if this provider already exists
  const alreadyExists = existingProviders.some((p) => p.provider === selectedPreset.provider) && selectedPreset.provider !== 'custom';

  // Reset state when preset changes
  useEffect(() => {
    setApiKey('');
    setBaseUrl(selectedPreset.baseUrl || '');
    setDynamicModels([]);
    setSelectedModels(new Set());
    setModelsLoaded(false);
    setModelSearch('');
  }, [selectedPreset]);

  const handleLoadModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const params = new URLSearchParams({ provider: selectedPreset.provider });
      if (apiKey) params.set('apiKey', apiKey);
      if (baseUrl) params.set('baseUrl', baseUrl);

      const res = await fetch(`/api/providers/models?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDynamicModels(data.models || []);
        setModelsLoaded(true);
        // Auto-select free models
        const freeModelIds = (data.models || [])
          .filter((m: DynamicModelInfo) => m.isFree)
          .map((m: DynamicModelInfo) => m.id);
        setSelectedModels(new Set(freeModelIds));
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to load models');
      }
    } catch {
      toast.error('Failed to load models');
    } finally {
      setLoadingModels(false);
    }
  }, [selectedPreset.provider, apiKey, baseUrl]);

  // Filter models by search
  const filteredModels = useMemo(() => {
    if (!modelSearch) return dynamicModels;
    const q = modelSearch.toLowerCase();
    return dynamicModels.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    );
  }, [dynamicModels, modelSearch]);

  const handleToggleModel = useCallback((modelId: string) => {
    setSelectedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) next.delete(modelId);
      else next.add(modelId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedModels.size === filteredModels.length) {
      setSelectedModels(new Set());
    } else {
      setSelectedModels(new Set(filteredModels.map((m) => m.id)));
    }
  }, [selectedModels, filteredModels]);

  const handleSave = useCallback(async () => {
    if (selectedPreset.provider !== 'zai' && !apiKey.trim()) {
      toast.error('API key is required');
      return;
    }

    setSaving(true);
    try {
      // Build models list from selection
      const models = selectedModels.size > 0
        ? dynamicModels
            .filter((m) => selectedModels.has(m.id))
            .map((m) => ({
              id: m.id,
              name: m.name,
              type: m.type,
              capabilities: m.capabilities,
            }))
        : selectedPreset.models;

      // Build capabilities from selected models
      const allCapabilities = new Set(selectedPreset.capabilities);

      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: selectedPreset.name,
          provider: selectedPreset.provider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          models,
          capabilities: Array.from(allCapabilities),
          isActive: false,
          priority: existingProviders.length + 1,
        }),
      });

      if (res.ok) {
        toast.success(`${selectedPreset.name} provider added successfully`);
        onProviderAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to add provider');
      }
    } catch {
      toast.error('Failed to add provider');
    } finally {
      setSaving(false);
    }
  }, [selectedPreset, apiKey, baseUrl, selectedModels, dynamicModels, existingProviders.length, onProviderAdded]);

  const needsApiKey = selectedPreset.provider !== 'zai';

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Add AI Provider</h3>
        <p className="text-sm text-muted-foreground">
          Choose a provider preset and configure your API access.
        </p>
      </div>

      {/* Provider Presets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {PROVIDER_PRESETS.map((preset) => {
          const Icon = preset.icon;
          const isSelected = selectedPreset.provider === preset.provider;
          const isDisabled = preset.isBuiltIn || (existingProviders.some((p) => p.provider === preset.provider) && preset.provider !== 'custom');

          return (
            <motion.button
              key={preset.provider}
              whileHover={!isDisabled ? { scale: 1.02 } : undefined}
              whileTap={!isDisabled ? { scale: 0.98 } : undefined}
              onClick={() => !isDisabled && setSelectedPreset(preset)}
              disabled={isDisabled}
              className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm'
                  : isDisabled
                    ? 'border-border/50 bg-muted/30 opacity-60 cursor-not-allowed'
                    : 'border-border bg-card hover:border-emerald-500/50 hover:bg-muted/30'
              }`}
            >
              <div className={`flex items-center justify-center size-10 rounded-xl bg-gradient-to-br ${preset.gradient} text-white shadow-sm`}>
                <Icon className="size-5" />
              </div>
              <span className="font-medium text-xs">{preset.name}</span>
              <span className="text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                {preset.description}
              </span>
              {isDisabled && preset.isBuiltIn && (
                <Badge variant="secondary" className="text-[9px] absolute top-1.5 right-1.5">Built-in</Badge>
              )}
              {isDisabled && !preset.isBuiltIn && (
                <Badge variant="secondary" className="text-[9px] absolute top-1.5 right-1.5">Added</Badge>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Configuration Form */}
      <div className="rounded-xl border p-5 space-y-4 bg-card">
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center justify-center size-8 rounded-lg bg-gradient-to-br ${selectedPreset.gradient} text-white`}>
            <selectedPreset.icon className="size-4" />
          </div>
          <div>
            <h4 className="font-medium text-sm">{selectedPreset.name}</h4>
            <p className="text-xs text-muted-foreground">{selectedPreset.description}</p>
          </div>
        </div>

        <Separator />

        {/* API Key Input */}
        {needsApiKey && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Key className="size-3" /> API Key
            </label>
            <Input
              placeholder="Enter your API key..."
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-9"
            />
          </div>
        )}

        {/* Base URL Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Globe className="size-3" /> Base URL
          </label>
          <Input
            placeholder="https://api.example.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="h-9"
          />
        </div>

        {/* Capabilities Preview */}
        <div className="flex gap-1.5 flex-wrap">
          {selectedPreset.capabilities.map((cap) => {
            const capInfo = CAPABILITY_ICONS[cap];
            return capInfo ? (
              <Badge key={cap} variant="outline" className="gap-1 text-[10px] px-1.5 py-0.5">
                <capInfo.icon className={`size-3 ${capInfo.color}`} />
                {capInfo.label}
              </Badge>
            ) : null;
          })}
        </div>

        {/* Load Models Button */}
        {selectedPreset.supportsDynamicModels && needsApiKey && (
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={handleLoadModels}
              disabled={loadingModels || !apiKey.trim()}
            >
              {loadingModels ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {modelsLoaded ? 'Reload Models' : 'Load Available Models'}
            </Button>
            {!apiKey.trim() && (
              <p className="text-[10px] text-muted-foreground text-center">
                Enter your API key first to load available models
              </p>
            )}
          </div>
        )}

        {/* Dynamic Model Selection */}
        {modelsLoaded && dynamicModels.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Select Models ({selectedModels.size} of {dynamicModels.length} selected)
              </label>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleSelectAll}>
                {selectedModels.size === filteredModels.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            {/* Model search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                className="h-8 text-xs pl-8"
              />
            </div>

            <ScrollArea className="h-64 rounded-lg border">
              <div className="divide-y">
                {filteredModels.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleToggleModel(model.id)}
                  >
                    <Checkbox
                      checked={selectedModels.has(model.id)}
                      onCheckedChange={() => handleToggleModel(model.id)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-medium truncate">{model.name}</span>
                        {model.isFree && (
                          <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-1 py-0">
                            Free
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          {model.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                        {model.contextLength && (
                          <span>Context: {formatContextLength(model.contextLength)}</span>
                        )}
                        {formatPricing(model.pricing) !== '-' && (
                          <span>{formatPricing(model.pricing)}</span>
                        )}
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {model.capabilities?.slice(0, 4).map((cap) => {
                          const capInfo = CAPABILITY_ICONS[cap];
                          return capInfo ? (
                            <capInfo.icon key={cap} className={`size-3 ${capInfo.color}`} />
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Non-dynamic providers: show preset models */}
        {!selectedPreset.supportsDynamicModels && selectedPreset.models.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Default Models
            </label>
            <div className="max-h-40 overflow-y-auto rounded-lg border">
              {selectedPreset.models.map((model) => (
                <div key={model.id} className="flex items-center gap-2 px-3 py-2 text-xs border-b last:border-b-0">
                  <span className="font-mono flex-1">{model.id}</span>
                  <span className="text-muted-foreground">{model.name}</span>
                  <div className="flex gap-1">
                    {model.capabilities?.map((cap) => {
                      const capInfo = CAPABILITY_ICONS[cap];
                      return capInfo ? <capInfo.icon key={cap} className={`size-3 ${capInfo.color}`} /> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Save Button */}
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          onClick={handleSave}
          disabled={saving || (needsApiKey && !apiKey.trim())}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add {selectedPreset.name} Provider
        </Button>
      </div>
    </div>
  );
}

// ============ Rate Limits Overview ============

function RateLimitsOverview({
  providers,
  onRefresh,
}: {
  providers: ProviderInfo[];
  onRefresh: () => void;
}) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }, [onRefresh]);

  const providersWithLimits = providers.filter(
    (p) => (p.requestsLimit && p.requestsLimit > 0) || (p.tokensLimit && p.tokensLimit > 0) || p.isRateLimited
  );

  const allProviders = [
    // Z.ai built-in
    {
      id: 'zai-default',
      name: 'Z.ai',
      provider: 'zai',
      isActive: true,
      isRateLimited: false,
      requestsUsed: 0,
      requestsLimit: 0,
      tokensUsed: 0,
      tokensLimit: 0,
    },
    ...providers,
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Rate Limits & Usage</h3>
          <p className="text-sm text-muted-foreground">
            Monitor API usage and rate limit status for all providers.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`size-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {allProviders.filter((p) => p.isActive).length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Active Providers</div>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {allProviders.filter((p) => p.isRateLimited).length}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Rate Limited</div>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {allProviders.reduce((sum, p) => sum + (p.requestsUsed || 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total Requests</div>
        </div>
        <div className="rounded-xl border p-4 text-center">
          <div className="text-2xl font-bold text-foreground">
            {formatNumber(allProviders.reduce((sum, p) => sum + (p.tokensUsed || 0), 0))}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Total Tokens</div>
        </div>
      </div>

      {/* Provider Rate Limit Details */}
      {allProviders.map((provider) => {
        const hasData = (provider.requestsLimit && provider.requestsLimit > 0) || (provider.tokensLimit && provider.tokensLimit > 0) || provider.isRateLimited;
        const preset = PROVIDER_PRESETS.find((p) => p.provider === provider.provider);
        const gradient = preset?.gradient || 'from-gray-500 to-gray-600';
        const Icon = preset?.icon || Settings2;

        return (
          <div
            key={provider.id}
            className={`rounded-xl border p-5 space-y-4 ${provider.isRateLimited ? 'ring-1 ring-amber-500/40' : ''}`}
          >
            {/* Provider Header */}
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center size-8 rounded-lg bg-gradient-to-br ${gradient} text-white shrink-0`}>
                <Icon className="size-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{provider.name}</span>
                  {provider.isRateLimited && (
                    <Badge variant="secondary" className="text-[10px] gap-1 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      <AlertTriangle className="size-3" />
                      Rate Limited
                    </Badge>
                  )}
                  {provider.isActive && !provider.isRateLimited && (
                    <Badge variant="secondary" className="text-[10px] gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      <CheckCircle2 className="size-3" />
                      Active
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{provider.provider}</span>
              </div>
            </div>

            {/* Rate Limit Bars */}
            {hasData ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Requests */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Requests</span>
                    <span className={getRateLimitTextColor(provider.requestsUsed || 0, provider.requestsLimit || 1)}>
                      {provider.requestsUsed || 0} / {provider.requestsLimit || '∞'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getRateLimitColor(provider.requestsUsed || 0, provider.requestsLimit || 1)}`}
                      style={{
                        width: provider.requestsLimit
                          ? `${Math.min(100, ((provider.requestsUsed || 0) / provider.requestsLimit) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  {provider.requestsResetAt && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <RotateCw className="size-3" />
                      {formatResetTime(provider.requestsResetAt)}
                    </div>
                  )}
                </div>

                {/* Tokens */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Tokens</span>
                    <span className={getRateLimitTextColor(provider.tokensUsed || 0, provider.tokensLimit || 1)}>
                      {formatNumber(provider.tokensUsed || 0)} / {provider.tokensLimit ? formatNumber(provider.tokensLimit) : '∞'}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${getRateLimitColor(provider.tokensUsed || 0, provider.tokensLimit || 1)}`}
                      style={{
                        width: provider.tokensLimit
                          ? `${Math.min(100, ((provider.tokensUsed || 0) / provider.tokensLimit) * 100)}%`
                          : '0%',
                      }}
                    />
                  </div>
                  {provider.tokensResetAt && (
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <RotateCw className="size-3" />
                      {formatResetTime(provider.tokensResetAt)}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-3">
                No rate limit data available for this provider
              </div>
            )}

            {/* Last Error */}
            {provider.lastError && (
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400 rounded-md border border-amber-200 dark:border-amber-800/50 p-2.5 bg-amber-50/50 dark:bg-amber-900/20">
                <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Last Error: </span>
                  {provider.lastError}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {providersWithLimits.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="size-14 rounded-2xl bg-muted flex items-center justify-center">
            <Shield className="size-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">No rate limit data yet</p>
          <p className="text-muted-foreground text-xs">Rate limits will appear once you start using your providers</p>
        </div>
      )}
    </div>
  );
}

export default ProviderSettingsDialog;
