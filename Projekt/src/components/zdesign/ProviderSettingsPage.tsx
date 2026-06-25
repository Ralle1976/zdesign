'use client';

/**
 * ProviderSettingsPage — full-screen provider management UI.
 *
 * - Fetches GET /api/providers, groups by type (TEXT / IMAGE / AUDIO / VIDEO)
 * - Per-provider card: status dot, model dropdown, API-key save (POST /keys),
 *   MCP connect, read-only endpoint, Test (POST /test) with inline result,
 *   image pricing/quota.
 * - Active toggle is radio-per-type (only one text + one image active).
 * - Save Configuration POSTs the full config to /api/providers.
 *
 * The card subcomponent + types/helpers live in ./provider-settings/shared.
 */
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, RefreshCw, Save, Plug, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  type ProviderType,
  type ParsedProvider,
  type DbProvider,
  type TestState,
  TYPE_TABS,
  classifyProvider,
  parseProvider,
  ProviderCardRow,
} from './provider-settings/shared';

export function ProviderSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [providers, setProviders] = useState<ParsedProvider[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProviderType>('TEXT');

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [mcpUrls, setMcpUrls] = useState<Record<string, string>>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const raw: DbProvider[] = data.providers || [];
      setProviders(raw.map(parseProvider));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Radio-style activation: only one active per type.
  const setActive = useCallback((id: string, value: boolean, type: ProviderType) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (classifyProvider(p) !== type) return p;
        return p.id === id ? { ...p, isActive: value } : value ? { ...p, isActive: false } : p;
      })
    );
    setDirty(true);
  }, []);

  const handleTest = useCallback(async (p: ParsedProvider) => {
    setTests((prev) => ({ ...prev, [p.id]: { loading: true, result: null } }));
    try {
      const res = await fetch('/api/providers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: p.id }),
      });
      const data = await res.json().catch(() => ({}));
      const success = res.ok && data.success !== false;
      setTests((prev) => ({
        ...prev,
        [p.id]: {
          loading: false,
          result: {
            success,
            message: data.message || (success ? 'Connection successful' : `Test failed (HTTP ${res.status})`),
          },
        },
      }));
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        [p.id]: { loading: false, result: { success: false, message: e instanceof Error ? e.message : 'Network error' } },
      }));
    }
  }, []);

  const handleSaveKey = useCallback(async (p: ParsedProvider) => {
    const key = (apiKeys[p.id] || '').trim();
    if (!key) return;
    try {
      const res = await fetch('/api/providers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: p.id, apiKey: key }),
      });
      const ok = res.ok;
      setTests((prev) => ({
        ...prev,
        [p.id]: {
          loading: false,
          result: ok ? { success: true, message: 'API key saved.' } : { success: false, message: `Save failed (HTTP ${res.status})` },
        },
      }));
      if (ok) {
        setApiKeys((prev) => ({ ...prev, [p.id]: '' }));
        setProviders((prev) =>
          prev.map((x) => (x.id === p.id ? { ...x, apiKey: `${key.slice(0, 8)}...${key.slice(-4)}` } : x))
        );
      }
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        [p.id]: { loading: false, result: { success: false, message: e instanceof Error ? e.message : 'Network error' } },
      }));
    }
  }, [apiKeys]);

  const handleConnectMcp = useCallback(async (p: ParsedProvider) => {
    const url = (mcpUrls[p.id] || '').trim();
    if (!url) return;
    try {
      const res = await fetch('/api/providers/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerId: p.id, baseUrl: url }),
      });
      const ok = res.ok;
      setTests((prev) => ({
        ...prev,
        [p.id]: {
          loading: false,
          result: ok ? { success: true, message: 'MCP endpoint connected.' } : { success: false, message: `Connect failed (HTTP ${res.status})` },
        },
      }));
      if (ok) {
        setMcpUrls((prev) => ({ ...prev, [p.id]: '' }));
        setProviders((prev) => prev.map((x) => (x.id === p.id ? { ...x, baseUrl: url } : x)));
      }
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        [p.id]: { loading: false, result: { success: false, message: e instanceof Error ? e.message : 'Network error' } },
      }));
    }
  }, [mcpUrls]);

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      const payload = providers.map((p) => ({ id: p.id, isActive: p.isActive, models: p.modelList }));
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: payload }),
      });
      const ok = res.ok;
      setTests((prev) => ({
        ...prev,
        __global__: {
          loading: false,
          result: ok ? { success: true, message: 'Configuration saved.' } : { success: false, message: `Save failed (HTTP ${res.status})` },
        },
      }));
      if (ok) setDirty(false);
    } catch (e) {
      setTests((prev) => ({
        ...prev,
        __global__: { loading: false, result: { success: false, message: e instanceof Error ? e.message : 'Network error' } },
      }));
    } finally {
      setSaving(false);
    }
  }, [providers]);

  const grouped: Record<ProviderType, ParsedProvider[]> = { TEXT: [], IMAGE: [], AUDIO: [], VIDEO: [] };
  for (const p of providers) grouped[classifyProvider(p)].push(p);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b shrink-0">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Plug className="size-4 text-emerald-500" />
            Providers
          </h2>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Manage AI providers, API keys, models, and quota across all generation types.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={fetchProviders} disabled={loading}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleSaveConfig} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save Configuration
          </Button>
        </div>
      </div>

      {tests.__global__?.result && (
        <div
          className={`mx-4 sm:mx-6 mt-3 flex items-center gap-2 rounded-md p-2 text-xs ${
            tests.__global__.result.success
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {tests.__global__.result.success ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {tests.__global__.result.message}
        </div>
      )}

      {error && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-2 rounded-md p-2 text-xs bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400">
          <AlertTriangle className="size-3.5" />
          {error}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ProviderType)} className="flex-1 flex flex-col min-h-0">
        <div className="px-4 sm:px-6 pt-3 shrink-0">
          <TabsList className="w-full sm:w-auto flex-wrap h-auto">
            {TYPE_TABS.map((tab) => {
              const Icon = tab.icon;
              const count = grouped[tab.key].length;
              return (
                <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 flex-1 sm:flex-none">
                  <Icon className="size-3.5" />
                  {tab.label}
                  {count > 0 && (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 sm:p-6 pt-4">
            {TYPE_TABS.map((tab) => (
              <TabsContent key={tab.key} value={tab.key} className="mt-0">
                {loading ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} className="h-64 rounded-xl" />
                    ))}
                  </div>
                ) : grouped[tab.key].length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
                    <tab.icon className="size-8 mb-2 opacity-40" />
                    No {tab.label.toLowerCase()} providers configured.
                    <span className="text-xs mt-1">Add one via the API or environment variables.</span>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {grouped[tab.key].map((p) => (
                      <ProviderCardRow
                        key={p.id}
                        p={p}
                        active={p.isActive}
                        testState={tests[p.id] || { loading: false, result: null }}
                        apiKeyInput={apiKeys[p.id] || ''}
                        mcpInput={mcpUrls[p.id] || ''}
                        onActiveChange={(v) => setActive(p.id, v, tab.key)}
                        onModelChange={() => setDirty(true)}
                        onApiKeyInput={(v) => setApiKeys((prev) => ({ ...prev, [p.id]: v }))}
                        onMcpInput={(v) => setMcpUrls((prev) => ({ ...prev, [p.id]: v }))}
                        onTest={() => handleTest(p)}
                        onSaveKey={() => handleSaveKey(p)}
                        onConnectMcp={() => handleConnectMcp(p)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}
