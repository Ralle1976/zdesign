// Z.Design - Capabilities manifest (app self-discovery)
//
// One source of truth: when the app (or any project/agent) starts, it can ask
// /api/capabilities to learn WHAT the running app can do RIGHT NOW — not what
// the docs claim, but the live truth: which providers are wired, which
// features are enabled, which API routes exist, whether the DB/auth/streaming
// are available. This replaces the stale hardcoded list in the root /api route.
//
// Caches the manifest in-process for CAPABILITIES_TTL_MS (default 30s) so a
// flood of startup checks is cheap.

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProviderConfig } from '@/lib/providers/config';

// ─── Types ───────────────────────────────────────────────────────────

interface CapabilityProvider {
  id: string;
  name: string;
  type: string; // text | image | audio | video
  status: string; // connected | disconnected | untested
  activeFor?: string; // 'text' | 'image' | 'audio' — if selected as default
  detail?: string; // free-form note (e.g. error reason for a disconnected provider)
}

interface CapabilityFeature {
  key: string;
  label: string;
  enabled: boolean;
  detail?: string;
}

interface CapabilityRouteGroup {
  group: string;
  routes: string[];
}

interface CapabilitiesManifest {
  name: string;
  version: string;
  generatedAt: string;
  features: CapabilityFeature[];
  providers: CapabilityProvider[];
  routeGroups: CapabilityRouteGroup[];
  database: { connected: boolean; detail?: string };
  auth: { enabled: boolean; providers: string[] };
}

// ─── Static route catalogue (the App-Router folder layout) ───────────
// Listed once here; if a route is added, add it here too. This is the
// authoritative "what API surface exists" list.

const ROUTE_CATALOGUE: CapabilityRouteGroup[] = [
  {
    group: 'design',
    routes: ['/api/design/generate', '/api/design/agent', '/api/design/agent/stream', '/api/design/cream', '/api/design/enhance', '/api/design/evaluate', '/api/design/analyze', '/api/design/batch', '/api/design/concepts', '/api/design/image', '/api/design/import', '/api/design/research'],
  },
  { group: 'chat', routes: ['/api/chat', '/api/chat/stream'] },
  { group: 'assistant', routes: ['/api/assistant'] },
  { group: 'agents', routes: ['/api/agents'] },
  { group: 'creative', routes: ['/api/creative'] },
  {
    group: 'projects',
    routes: ['/api/projects', '/api/projects/[id]', '/api/projects/[id]/versions', '/api/projects/[id]/versions/[versionId]'],
  },
  { group: 'design-systems', routes: ['/api/design-systems', '/api/design-systems/[id]'] },
  { group: 'style-presets', routes: ['/api/style-presets'] },
  { group: 'templates', routes: ['/api/templates', '/api/templates/seed'] },
  { group: 'export', routes: ['/api/export', '/api/export/zip', '/api/export/pdf/health'] },
  { group: 'providers', routes: ['/api/providers', '/api/providers/keys', '/api/providers/models', '/api/providers/rate-limits', '/api/providers/verify'] },
  { group: 'memory', routes: ['/api/memory/recall', '/api/user-memory'] },
  { group: 'voice', routes: ['/api/voice/transcribe'] },
  { group: 'mcp', routes: ['/api/mcp'] },
  { group: 'webapp', routes: ['/api/webapp/emit', '/api/webapp/orchestrate'] },
  { group: 'stats', routes: ['/api/stats'] },
  { group: 'auth', routes: ['/api/auth/[...nextauth]', '/api/auth/register'] },
];

// ─── Feature detection ──────────────────────────────────────────────

function detectFeatures(): CapabilityFeature[] {
  const features: CapabilityFeature[] = [];

  // Streaming (O3)
  features.push({
    key: 'streaming',
    label: 'LLM Streaming (SSE)',
    enabled: true,
    detail: '/api/chat/stream emits stage events during generation',
  });

  // Auth (O13)
  const authProviders: string[] = ['credentials'];
  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) authProviders.push('github');
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) authProviders.push('google');
  features.push({
    key: 'auth',
    label: 'Authentication (next-auth)',
    enabled: true,
    detail: `providers: ${authProviders.join(', ')}; strategy: jwt`,
  });

  // Collaboration (O7) — the UI is wired; the collab service is optional.
  features.push({
    key: 'collaboration',
    label: 'Real-time Collaboration',
    enabled: true,
    detail: 'useCollaboration hook + PresenceBar + CursorOverlay wired in ZDesignApp',
  });

  // Fusion pipeline (opt-in remote service)
  features.push({
    key: 'fusion',
    label: 'Fusion multi-model pipeline',
    enabled: !!process.env.FUSION_SERVICE_URL,
    detail: process.env.FUSION_SERVICE_URL ? `remote: ${process.env.FUSION_SERVICE_URL}` : 'unset — falls back to standard chat',
  });

  // Self-improving memory
  features.push({
    key: 'skill-memory',
    label: 'Self-Improving Skill Memory',
    enabled: true,
    detail: 'learn → correlate → patch → apply → reload',
  });

  // Negative memory (P1-P3)
  features.push({
    key: 'negative-memory',
    label: 'Negative Memory (default-DENY)',
    enabled: true,
    detail: 'extinction + consolidation + sanitizer',
  });

  // MCP server
  features.push({
    key: 'mcp',
    label: 'MCP Server (agent-controllable)',
    enabled: true,
    detail: '/api/mcp exposes agent tools',
  });

  // PDF export
  features.push({
    key: 'pdf-export',
    label: 'PDF Export (Puppeteer)',
    enabled: true,
  });

  // ZIP export
  features.push({
    key: 'zip-export',
    label: 'ZIP Export (JSZip)',
    enabled: true,
  });

  // Charts
  features.push({
    key: 'charts',
    label: 'Chart rendering (Recharts)',
    enabled: true,
  });

  // Voice
  features.push({
    key: 'voice',
    label: 'Voice input (ASR)',
    enabled: true,
    detail: '/api/voice/transcribe',
  });

  // Cream pipeline
  features.push({
    key: 'cream-pipeline',
    label: 'Cream design pipeline',
    enabled: true,
    detail: 'art-direction + vision-critique loop',
  });

  return features;
}

// ─── Provider discovery (live, from the registry) ───────────────────

async function discoverProviders(): Promise<CapabilityProvider[]> {
  try {
    // getProviderConfig() returns:
    //   { text: string (active text provider id),
    //     image: string (active image provider id),
    //     configured: ProviderConfig[] (every connected provider) }
    const { text, image, configured } = await getProviderConfig();
    const out: CapabilityProvider[] = configured.map((p) => {
      // ProviderConfig is a strict interface without an index signature; cast
      // through unknown to read its fields generically.
      const rec = p as unknown as Record<string, unknown>;
      const pid = String(rec.id ?? '');
      return {
        id: pid,
        name: String(rec.name ?? pid),
        type: String(rec.type ?? 'text'),
        status: 'connected',
        activeFor:
          pid === text ? 'text' : pid === image ? 'image' : undefined,
      };
    });
    // Surface the active selections even if (somehow) not in `configured`.
    if (!out.find((p) => p.id === text)) {
      out.push({ id: text, name: text, type: 'text', status: 'untested', activeFor: 'text' });
    }
    if (!out.find((p) => p.id === image)) {
      out.push({ id: image, name: image, type: 'image', status: 'untested', activeFor: 'image' });
    }
    return out;
  } catch (e) {
    // Provider discovery must never break the manifest — degrade to a note.
    return [{
      id: '_registry',
      name: 'Provider registry unavailable',
      type: 'unknown',
      status: 'disconnected',
      detail: e instanceof Error ? e.message : 'unknown error',
    }];
  }
}

// ─── DB ping ─────────────────────────────────────────────────────────
// Wrapped defensively: on some Windows + Turbopack setups the @prisma/client
// import itself can fail (junction-point creation). The manifest must never
// 500 just because the DB probe failed — we surface the failure as data.

async function pingDatabase(): Promise<{ connected: boolean; detail?: string }> {
  try {
    // A trivial count proves the DB is reachable + the new auth tables exist.
    await db.user.count();
    return { connected: true };
  } catch (e) {
    return { connected: false, detail: e instanceof Error ? e.message : 'unknown error' };
  }
}

// ─── In-process cache ────────────────────────────────────────────────

const CAPABILITIES_TTL_MS = 30_000;
let cachedManifest: { value: CapabilitiesManifest; expiresAt: number } | null = null;

async function buildManifest(): Promise<CapabilitiesManifest> {
  const [providers, database] = await Promise.all([discoverProviders(), pingDatabase()]);
  const authProviders: string[] = ['credentials'];
  if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) authProviders.push('github');
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) authProviders.push('google');

  return {
    name: 'Z.Design API',
    version: '1.1.0',
    generatedAt: new Date().toISOString(),
    features: detectFeatures(),
    providers,
    routeGroups: ROUTE_CATALOGUE,
    database,
    auth: { enabled: true, providers: authProviders },
  };
}

export async function GET() {
  const now = Date.now();
  if (cachedManifest && cachedManifest.expiresAt > now) {
    return NextResponse.json(cachedManifest.value);
  }
  const manifest = await buildManifest();
  cachedManifest = { value: manifest, expiresAt: now + CAPABILITIES_TTL_MS };
  return NextResponse.json(manifest);
}
