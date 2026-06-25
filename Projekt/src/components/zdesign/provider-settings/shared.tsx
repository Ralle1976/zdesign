'use client';

/**
 * Shared types, helpers, and the ProviderCardRow subcomponent for the
 * ProviderSettingsPage. Split out to keep the main page under 500 lines.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Key,
  Plug,
  CheckCircle2,
  XCircle,
  Circle,
  RefreshCw,
  Save,
  AlertTriangle,
  Link2,
  Type,
  ImageIcon,
  Volume2,
  Video,
} from 'lucide-react';

// ============ Types ============

export type ProviderType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';

export interface DbProvider {
  id: string;
  name: string;
  provider: string;
  apiKey: string | null;
  baseUrl: string | null;
  models: string; // stringified JSON
  capabilities: string; // stringified JSON
  isActive: boolean;
  priority: number;
  config: string; // stringified JSON
  requestsUsed?: number;
  requestsLimit?: number;
  requestsRemaining?: number;
  tokensUsed?: number;
  tokensLimit?: number;
  tokensRemaining?: number;
  isRateLimited?: boolean;
  lastError?: string | null;
  lastUsedAt?: string | null;
  type?: ProviderType;
}

export interface ParsedProvider extends DbProvider {
  modelList: string[];
  capabilityList: string[];
}

export interface TestState {
  loading: boolean;
  result: { success: boolean; message: string } | null;
}

export const TYPE_TABS: { key: ProviderType; label: string; icon: typeof Type }[] = [
  { key: 'TEXT', label: 'Text LLM', icon: Type },
  { key: 'IMAGE', label: 'Image', icon: ImageIcon },
  { key: 'AUDIO', label: 'Audio', icon: Volume2 },
  { key: 'VIDEO', label: 'Video', icon: Video },
];

// ============ Helpers ============

const TYPE_KEYWORDS: Record<ProviderType, string[]> = {
  TEXT: ['zai', 'anthropic', 'claude', 'openai', 'gpt', 'openrouter', 'gemini', 'llm', 'chat'],
  IMAGE: ['minimax', 'replicate', 'flux', 'higgsfield', 'stability', 'dalle', 'image'],
  AUDIO: ['whisper', 'elevenlabs', 'tts', 'speech', 'audio'],
  VIDEO: ['sora', 'runway', 'pika', 'video', 'kling'],
};

export function classifyProvider(p: DbProvider): ProviderType {
  const hay = `${p.provider} ${p.name}`.toLowerCase();
  try {
    const cfg = JSON.parse(p.config || '{}');
    if (cfg.type) return cfg.type as ProviderType;
  } catch { /* ignore */ }
  for (const t of Object.keys(TYPE_KEYWORDS) as ProviderType[]) {
    if (TYPE_KEYWORDS[t].some((k) => hay.includes(k))) return t;
  }
  try {
    const caps = JSON.parse(p.capabilities || '[]') as string[];
    if (caps.some((c) => c.includes('image'))) return 'IMAGE';
    if (caps.some((c) => c.includes('speech'))) return 'AUDIO';
  } catch { /* ignore */ }
  return 'TEXT';
}

export function parseProvider(p: DbProvider): ParsedProvider {
  let modelList: string[] = [];
  let capabilityList: string[] = [];
  try {
    const m = JSON.parse(p.models || '[]');
    modelList = Array.isArray(m)
      ? m.map((x) => (typeof x === 'string' ? x : x?.id || x?.name || JSON.stringify(x)))
      : [];
  } catch { /* ignore */ }
  try {
    const c = JSON.parse(p.capabilities || '[]');
    capabilityList = Array.isArray(c) ? c.map(String) : [];
  } catch { /* ignore */ }
  return { ...p, modelList, capabilityList };
}

export function isMcpProvider(p: ParsedProvider): boolean {
  const hay = `${p.provider} ${p.name}`.toLowerCase();
  return hay.includes('higgsfield') || hay.includes('mcp');
}

// ============ Status Dot ============

function StatusDot({ p, test }: { p: ParsedProvider; test: TestState }) {
  if (test.loading) return <Loader2 className="size-3.5 animate-spin text-muted-foreground" />;
  if (test.result) {
    return test.result.success ? (
      <CheckCircle2 className="size-3.5 text-emerald-500" />
    ) : (
      <XCircle className="size-3.5 text-red-500" />
    );
  }
  if (p.isRateLimited) return <XCircle className="size-3.5 text-red-500" />;
  if (p.apiKey || isMcpProvider(p)) return <CheckCircle2 className="size-3.5 text-emerald-500" />;
  return <Circle className="size-3.5 text-muted-foreground/40" />;
}

// ============ Provider Card ============

export interface ProviderCardRowProps {
  p: ParsedProvider;
  active: boolean;
  testState: TestState;
  apiKeyInput: string;
  mcpInput: string;
  onActiveChange: (v: boolean) => void;
  onModelChange: (m: string) => void;
  onApiKeyInput: (v: string) => void;
  onMcpInput: (v: string) => void;
  onTest: () => void;
  onSaveKey: () => void;
  onConnectMcp: () => void;
}

export function ProviderCardRow({
  p,
  active,
  testState,
  apiKeyInput,
  mcpInput,
  onActiveChange,
  onModelChange,
  onApiKeyInput,
  onMcpInput,
  onTest,
  onSaveKey,
  onConnectMcp,
}: ProviderCardRowProps) {
  const mcp = isMcpProvider(p);
  const hasKey = !!p.apiKey;
  const selectedModel = p.modelList[0] || '';

  return (
    <Card
      className={`transition-all ${
        active
          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-900/10 shadow-sm'
          : 'border-border bg-card'
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <StatusDot p={p} test={testState} />
            <CardTitle className="text-sm font-semibold truncate">{p.name}</CardTitle>
            {active && (
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
                Active
              </Badge>
            )}
            {p.isRateLimited && (
              <Badge className="text-[9px] px-1.5 py-0 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
                Rate limited
              </Badge>
            )}
          </div>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer shrink-0">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={active}
              onChange={(e) => onActiveChange(e.target.checked)}
            />
            <span className="relative inline-flex h-4 w-7 items-center rounded-full bg-input peer-checked:bg-emerald-500 transition-colors">
              <span
                className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${
                  active ? 'translate-x-3.5' : 'translate-x-0.5'
                }`}
              />
            </span>
          </label>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {testState.result && (
          <div
            className={`flex items-start gap-2 rounded-md p-2 text-[11px] ${
              testState.result.success
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            }`}
          >
            {testState.result.success ? (
              <CheckCircle2 className="size-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
            )}
            <span className="break-words">{testState.result.message}</span>
          </div>
        )}

        {p.modelList.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground">Model</span>
            <Select defaultValue={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {p.modelList.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {mcp ? (
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Link2 className="size-3" /> MCP URL
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="https://mcp.example.com/sse"
                value={mcpInput}
                onChange={(e) => onMcpInput(e.target.value)}
                className="h-9 text-sm font-mono"
              />
              <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={onConnectMcp}>
                <Plug className="size-3.5" />
                Connect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Key className="size-3" /> API Key
            </span>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder={hasKey ? p.apiKey || '••••••••' : 'Enter API key…'}
                value={apiKeyInput}
                onChange={(e) => onApiKeyInput(e.target.value)}
                className="h-9 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5"
                onClick={onSaveKey}
                disabled={!apiKeyInput.trim()}
              >
                <Save className="size-3.5" />
                Save
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <span className="text-[11px] text-muted-foreground">Endpoint</span>
          {mcp ? (
            <Input
              placeholder="https://…"
              value={p.baseUrl || ''}
              readOnly
              className="h-9 text-xs font-mono bg-muted/50"
            />
          ) : (
            <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-xs font-mono text-muted-foreground truncate">
              {p.baseUrl || '—'}
            </div>
          )}
        </div>

        {classifyProvider(p) === 'IMAGE' && (
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Requests</div>
              <div className="font-medium">
                {p.requestsUsed ?? 0}
                {(p.requestsLimit ?? 0) > 0 ? ` / ${p.requestsLimit}` : ''}
              </div>
              {(p.requestsRemaining ?? -1) > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {p.requestsRemaining} left
                </div>
              )}
            </div>
            <div className="rounded-md bg-muted/50 p-2">
              <div className="text-muted-foreground">Tokens</div>
              <div className="font-medium">
                {p.tokensUsed ?? 0}
                {(p.tokensLimit ?? 0) > 0 ? ` / ${p.tokensLimit}` : ''}
              </div>
              {(p.tokensRemaining ?? -1) > 0 && (
                <div className="text-emerald-600 dark:text-emerald-400">
                  {p.tokensRemaining} left
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={onTest}
            disabled={testState.loading}
          >
            {testState.loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            Test
          </Button>
          {p.lastError && (
            <span className="text-[10px] text-red-500 truncate" title={p.lastError}>
              {p.lastError}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
