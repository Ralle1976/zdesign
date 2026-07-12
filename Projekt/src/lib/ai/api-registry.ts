/**
 * api-registry.ts — the AI's map of Z.Design's own backend.
 *
 * The keystone for "the AI assistant knows every API route and can control
 * everything": auto-discover every Next.js App-Router route under src/app/api,
 * extract its HTTP methods, and expose a machine-readable manifest. The MCP
 * tools zdesign_api_routes (read the map) + zdesign_call_route (invoke any) let
 * an agent drive the whole backend without guessing endpoints.
 *
 * Pure + synchronous discovery (reads the filesystem once, cached per process).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

export interface ApiRouteInfo {
  /** HTTP path, e.g. '/api/design/agent'. */
  path: string;
  /** Methods the route exports, e.g. ['GET','POST']. */
  methods: string[];
  /** Has dynamic segments ([id], [...slug]). */
  dynamic: boolean;
  /** File path relative to project root. */
  file: string;
  /** Best-effort one-line description (first JSDoc/comment in the file). */
  description?: string;
}

const API_ROOT = join(process.cwd(), 'src', 'app', 'api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
let CACHE: ApiRouteInfo[] | null = null;

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === 'route.ts' || name === 'route.tsx') out.push(full);
  }
}

function extractMethods(file: string): string[] {
  try {
    const src = readFileSync(file, 'utf8');
    return METHODS.filter((m) => new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src));
  } catch {
    return [];
  }
}

function extractDescription(file: string): string | undefined {
  try {
    const src = readFileSync(file, 'utf8');
    // first // or /* */ comment block near the top
    const block = src.match(/\/\*\*([\s\S]*?)\*\//);
    if (block) {
      const line = block[1].split('\n').map((l) => l.replace(/^\s*\* ?/, '').trim()).find((l) => l && !l.startsWith('@'));
      if (line) return line.slice(0, 160);
    }
    const slash = src.match(/^\/\/\s*(.+)$/m);
    if (slash) return slash[1].slice(0, 160);
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Discover all API routes (cached). */
export function getApiRoutes(): ApiRouteInfo[] {
  if (CACHE) return CACHE;
  const files: string[] = [];
  try {
    walk(API_ROOT, files);
  } catch {
    CACHE = [];
    return CACHE;
  }
  CACHE = files.map((file) => {
    const rel = relative(join(process.cwd(), 'src', 'app'), file).replace(/\/route\.tsx?$/, '');
    const path = '/' + rel.replace(/\[+/g, ':').replace(/\]+/g, ''); // [id] -> :id
    return {
      path,
      methods: extractMethods(file),
      dynamic: /\[/.test(rel),
      file: relative(process.cwd(), file),
      description: extractDescription(file),
    };
  }).sort((a, b) => a.path.localeCompare(b.path));
  return CACHE;
}

/** Compact manifest for the AI: [{path, methods}]. */
export function apiManifest(): { routes: ApiRouteInfo[]; count: number } {
  const routes = getApiRoutes();
  return { routes, count: routes.length };
}
