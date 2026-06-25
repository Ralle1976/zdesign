'use client';

/**
 * Shared types, helpers, and the ProviderCardRow subcomponent for the
 * ProviderSettingsPage. Split out to keep the main page under 500 lines.
 *
 * These types mirror the REAL GET /api/providers contract from
 * src/lib/ai/provider-config.ts (ProviderStatus + selection/overrides):
 *   { id, name, kind:'text'|'image', envKey, envBaseUrl, defaultModel,
 *     models:[{id,name}], configured, maskedKey }
 * plus the top-level { selection:{textProviderId,imageProviderId}, overrides }.
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

/** Exact shape returned per provider by GET /api/providers (`providers[]`). */
export interface ProviderDTO {
  id: string;
  name: string;
  kind: 'text' | 'image';
  envKey?: string;
  envBaseUrl?: string;
  defaultModel: string;
  models: { id: string; name: string }[];
  configured: boolean;
  maskedKey: string | null;
}

/** Top-level GET /api/providers response. */
export interface ProvidersResponse {
  providers: ProviderDTO[];
  selection: { textProviderId: string; imageProviderId: string };
  overrides: Record<string, { enabled?: boolean; model?: string; mcpUrl?: string }>;
}

/** ProviderDTO enriched with parsed/derived UI state. */
export interface ParsedProvider extends ProviderDTO {
  modelList: string[];
  isActive: boolean;
  selectedModel: string;
  mcpUrl: string;
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

/** Classify a provider into a UI tab. The API `kind` is authoritative. */
export function classifyProvider(p: ProviderDTO | ParsedProvider): ProviderType {
  if (p.kind === 'image') return 'IMAGE';
  return 'TEXT';
}

/**
 * Normalize a raw provider DTO into the ParsedProvider the card renders.
 * Applies the current selection (active text/image) and overrides (pinned
 * model / MCP url) so the UI reflects what's persisted on disk.
 */
export function parseProvider(
  p: ProviderDTO,
  selection: ProvidersResponse['selection'],
  overrides: ProvidersResponse['overrides'],
): ParsedProvider {
  const modelList = (p.models || []).map((m) => m.id);
  const ov = overrides?.[p.id] || {};
  return {
    ...p,
    modelList,
    isActive:
      (p.kind === 'text' && p.id === selection.textProviderId) ||
      (p.kind === 'image' && p.id === selection.imageProviderId),
    selectedModel: ov.model || p.defaultModel || modelList[0] || '',
    mcpUrl: ov.mcpUrl || '',
  };
}

/** Providers that can be reached over MCP (Higgsfield exposes an MCP server). */
export function isMcpProvider(p: ProviderDTO | ParsedProvider): boolean {
  const hay = `${p.id} ${p.name}`.toLowerCase();
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
  if (p.configured || isMcpProvider(p)) return <CheckCircle2 className="size-3.5 text-emerald-500" />;
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
  const hasKey = !!p.maskedKey;

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
            {!p.configured && !mcp && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground border-0">
                No key
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
            <Select value={p.selectedModel} onValueChange={onModelChange}>
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
                placeholder="https://mcp.higgsfield.ai/mcp"
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
                placeholder={hasKey ? p.maskedKey || '••••••••' : 'Enter API key…'}
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
              value={p.mcpUrl || ''}
              readOnly
              className="h-9 text-xs font-mono bg-muted/50"
            />
          ) : (
            <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-xs font-mono text-muted-foreground truncate">
              {p.envBaseUrl || '—'}
            </div>
          )}
        </div>

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
          {p.configured && (
            <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
              {p.maskedKey || 'configured'}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
