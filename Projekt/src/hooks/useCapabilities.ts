'use client';

// Z.Design - useCapabilities hook (app self-discovery)
//
// Fetches /api/capabilities once on mount so the running app knows what it
// can do: which features are enabled, which providers are wired, which routes
// exist, whether DB + auth are live. Consumers read the returned object;
// there is no need to plumb it through the global design store.

import { useEffect, useState } from 'react';

export interface CapabilityFeature {
  key: string;
  label: string;
  enabled: boolean;
  detail?: string;
}

export interface CapabilityProvider {
  id: string;
  name: string;
  type: string;
  status: string;
  activeFor?: string;
}

export interface CapabilityRouteGroup {
  group: string;
  routes: string[];
}

export interface CapabilitiesManifest {
  name: string;
  version: string;
  generatedAt: string;
  features: CapabilityFeature[];
  providers: CapabilityProvider[];
  routeGroups: CapabilityRouteGroup[];
  database: { connected: boolean; detail?: string };
  auth: { enabled: boolean; providers: string[] };
}

interface UseCapabilitiesResult {
  capabilities: CapabilitiesManifest | null;
  loading: boolean;
  error: string | null;
  /** Convenience helper: is a given feature key enabled? */
  hasFeature: (key: string) => boolean;
  /** Convenience helper: find a provider by id. */
  getProvider: (id: string) => CapabilityProvider | undefined;
}

export function useCapabilities(): UseCapabilitiesResult {
  const [capabilities, setCapabilities] = useState<CapabilitiesManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/capabilities', { cache: 'no-store' });
        if (!res.ok) throw new Error(`capabilities: status ${res.status}`);
        const data = (await res.json()) as CapabilitiesManifest;
        if (!cancelled) {
          setCapabilities(data);
          // Surface a console banner so anyone opening devtools immediately
          // sees what this running app can do — useful for debugging.
          if (typeof console !== 'undefined') {
            const enabled = data.features.filter((f) => f.enabled).map((f) => f.key);
            console.info(
              `[Z.Design] capabilities loaded — features: ${enabled.join(', ')}; ` +
              `providers: ${data.providers.map((p) => p.id).join(', ')}; ` +
              `db: ${data.database.connected ? 'ok' : 'DOWN'}; ` +
              `auth: ${data.auth.providers.join('|')}`
            );
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed to load capabilities');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasFeature = (key: string) =>
    !!capabilities?.features.find((f) => f.key === key && f.enabled);

  const getProvider = (id: string) => capabilities?.providers.find((p) => p.id === id);

  return { capabilities, loading, error, hasFeature, getProvider };
}
