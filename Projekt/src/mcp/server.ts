// Z.Design — Minimal MCP server (S4).
//
// A hand-rolled Model Context Protocol server: JSON-RPC 2.0 over HTTP, mounted
// at /api/mcp (see ../app/api/mcp/route.ts). Deliberately NOT the full @modelcontextprotocol/sdk
// — just enough to expose five zdesign tools to an MCP-aware client (Claude
// Desktop, an agent harness, a CLI) over a single Streamable-HTTP endpoint.
//
// Tools exposed:
//   - zdesign_generate({ message, concept? }) → POST /api/design/agent
//   - zdesign_batch({ briefs[] })             → POST /api/design/batch
//   - zdesign_concepts({ message })           → POST /api/design/concepts
//   - zdesign_list_projects()                 → GET  /api/projects
//   - zdesign_get_project({ id })             → GET  /api/projects/[id]
//
// Security:
//   - Binds to localhost only (the Next.js route rejects non-loopback hosts).
//   - Bearer-token gate: when process.env.MCP_TOKEN is set, every request must
//     carry `Authorization: Bearer <MCP_TOKEN>`. If unset, the gate is open
//     (dev-only convenience — set MCP_TOKEN in any shared/production env).
//
// Transport: Streamable HTTP. The route accepts POST with a JSON-RPC body
// (single request). Responses are JSON-RPC 2.0 results/errors, one per
// request. `initialize` returns server caps + the tool list is available via
// `tools/list`.

/** A JSON-RPC 2.0 request (notification when id is absent). */
interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown> | unknown[];
}

interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

const PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'zdesign-mcp',
  version: '0.1.0',
};

/** Canonical JSON-RPC error codes. */
const ERR_PARSE_ERROR = -32700;
const ERR_INVALID_REQUEST = -32600;
const ERR_METHOD_NOT_FOUND = -32601;
const ERR_INVALID_PARAMS = -32602;
const ERR_INTERNAL = -32603;

// ---------------------------------------------------------------------------
// Tool metadata (advertised via tools/list).
// ---------------------------------------------------------------------------

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const TOOLS: ToolDef[] = [
  {
    name: 'zdesign_generate',
    description:
      'Run the agentic art-directed design loop for a message. Creates/updates a project and returns the generated HTML artifact + scores. Requires an existing projectId (pass it in concept.projectId or the message will create a fresh LANDING_PAGE project).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The design brief / user message.' },
        projectId: { type: 'string', description: 'Target project id (required by the agent route).' },
        concept: {
          type: 'object',
          description: 'Optional creative-direction concept to inject.',
        },
      },
      required: ['message', 'projectId'],
    },
  },
  {
    name: 'zdesign_cream',
    description:
      'CREAM pipeline: generate a design via the full agent loop (art-direction + creative-dna + memory + bespoke MiniMax images) then run the VISION-CRITIQUE LOOP (Puppeteer render -> GLM-4.6v critique -> refine) until score >= target. Returns { html, score, rounds, trace }. Use this for highest-quality (cream) designs.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The design brief / user message.' },
        projectId: { type: 'string', description: 'Target project id.' },
        target: { type: 'number', description: 'Quality target 1-10 (default 8).' },
        maxRounds: { type: 'number', description: 'Max vision-critique rounds (default 3).' },
      },
      required: ['message', 'projectId'],
    },
  },
  {
    name: 'zdesign_batch',
    description:
      'Generate multiple designs in one batch. Each brief becomes a new LANDING_PAGE project with generated HTML. Returns { designs, errors }.',
    inputSchema: {
      type: 'object',
      properties: {
        briefs: {
          type: 'array',
          description: 'Array of briefs.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              theme: { type: 'string' },
              palette: { type: 'string' },
              fonts: { type: 'string' },
              layout: { type: 'string' },
              imagery: { type: 'string' },
              effects: { type: 'string' },
            },
            required: ['name', 'theme'],
          },
        },
      },
      required: ['briefs'],
    },
  },
  {
    name: 'zdesign_concepts',
    description:
      'Generate creative-direction concepts for a message. Returns { concepts: [...] } (may be empty on model failure).',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The design brief / user message.' },
        count: { type: 'number', description: 'Number of concepts (1-6, default 3).' },
      },
      required: ['message'],
    },
  },
  {
    name: 'zdesign_list_projects',
    description: 'List all projects. Returns { projects: [...], pagination }.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number' },
        status: { type: 'string' },
        type: { type: 'string' },
      },
    },
  },
  {
    name: 'zdesign_get_project',
    description: 'Fetch a single project by id, including designHTML/designJSON.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Project id.' },
      },
      required: ['id'],
    },
  },
  {
    name: 'zdesign_recall_anti_patterns',
    description:
      'Read-only negative-memory recall. Returns ranked AVOID signals for a domain — anti-patterns from approved learned recipes + negative past design episodes (failures), scored by a bounded loss-aversion salience and token-budgeted. Call BEFORE generating for a domain so the agent does not repeat past failures.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Design domain/topic to recall avoid-patterns for (e.g. "thai spa", "coffee").' },
        context: { type: 'string', description: 'Optional extra context to match against past episodes.' },
        limit: { type: 'number', description: 'Max items (1-100, default 25).' },
        maxTokens: { type: 'number', description: 'Token budget for the returned payload (default 1200).' },
      },
      required: ['domain'],
    },
  },
];

// ---------------------------------------------------------------------------
// Internal HTTP helpers — call the app's own REST API. The base URL resolves to
// the same Next.js process (loopback). We prefer an explicit PORT, then fall
// back to a relative-ish localhost:3000 default.
// ---------------------------------------------------------------------------

function apiBase(): string {
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

async function apiFetch(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<unknown> {
  const { json, ...rest } = init ?? {};
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(rest.headers as Record<string, string> | undefined),
  };
  let body = rest.body;
  if (json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(`${apiBase()}${path}`, { ...rest, headers, body });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  if (!res.ok) {
    const message =
      (parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as Record<string, unknown>).error)
        : `upstream ${res.status}`) || `upstream ${res.status}`;
    throw new Error(message);
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Tool dispatch.
// ---------------------------------------------------------------------------

function requireString(params: Record<string, unknown>, key: string): string {
  const v = params[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Missing required string param: ${key}`);
  }
  return v;
}

function canCall(auth: AuthContext | undefined, need: 'read' | 'write'): boolean {
  if (!auth || auth.admin) return true;
  if (need === 'read') return auth.scopes.some((s) => s === 'read' || s === 'recall' || s === 'admin');
  return auth.scopes.includes('write') || auth.scopes.includes('admin');
}

async function dispatchTool(
  name: string,
  params: Record<string, unknown>,
  auth?: AuthContext,
): Promise<unknown> {
  // P2.3 scope guard (admin bypasses).
  const need = TOOL_SCOPE[name] ?? 'read';
  if (!canCall(auth, need)) {
    throw new Error(`insufficient scope: '${need}' required for ${name}, agent has [${auth?.scopes.join(',') ?? ''}]`);
  }
  switch (name) {
    case 'zdesign_generate': {
      const message = requireString(params, 'message');
      const projectId = requireString(params, 'projectId');
      const concept = params.concept;
      return apiFetch('/api/design/agent', {
        method: 'POST',
        json: { message, projectId, ...(concept ? { concept } : {}) },
      });
    }
    case 'zdesign_cream': {
      const message = requireString(params, 'message');
      const projectId = requireString(params, 'projectId');
      const json: Record<string, unknown> = { message, projectId };
      if (typeof params.target === 'number') json.target = params.target;
      if (typeof params.maxRounds === 'number') json.maxRounds = params.maxRounds;
      return apiFetch('/api/design/cream', { method: 'POST', json });
    }
    case 'zdesign_batch': {
      const briefs = params.briefs;
      if (!Array.isArray(briefs)) throw new Error('briefs must be an array');
      return apiFetch('/api/design/batch', { method: 'POST', json: { briefs } });
    }
    case 'zdesign_concepts': {
      const message = requireString(params, 'message');
      const body: Record<string, unknown> = { message };
      if (typeof params.count === 'number') body.count = params.count;
      return apiFetch('/api/design/concepts', { method: 'POST', json: body });
    }
    case 'zdesign_list_projects': {
      const qs = new URLSearchParams();
      if (typeof params.limit === 'number') qs.set('limit', String(params.limit));
      if (typeof params.status === 'string') qs.set('status', params.status);
      if (typeof params.type === 'string') qs.set('type', params.type);
      const suffix = qs.toString() ? `?${qs.toString()}` : '';
      return apiFetch(`/api/projects${suffix}`, { method: 'GET' });
    }
    case 'zdesign_get_project': {
      const id = requireString(params, 'id');
      return apiFetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'GET' });
    }
    case 'zdesign_recall_anti_patterns': {
      const domain = requireString(params, 'domain');
      const qs = new URLSearchParams({ domain });
      if (typeof params.context === 'string' && params.context.trim()) qs.set('context', params.context);
      // P2.3 cap recall breadth by the agent's trust tier (admin bypasses).
      const requested = typeof params.limit === 'number' ? params.limit : 25;
      const limit = auth?.admin ? requested : Math.min(requested, auth?.recallLimit ?? 25);
      qs.set('limit', String(limit));
      if (typeof params.maxTokens === 'number') qs.set('maxTokens', String(params.maxTokens));
      return apiFetch(`/api/memory/recall?${qs.toString()}`, { method: 'GET' });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// Auth — DEFAULT-DENY + scoped per-agent tokens (P2.3).
//
// Security model (realism-checked): the previous gate was OPEN whenever
// MCP_TOKEN was unset (server.ts default-open) — indefensible once the brain is
// reachable globally. Now:
//   - DEFAULT-DENY. Open ONLY when MCP_OPEN_DEV=1 is set explicitly (dev opt-in).
//   - MCP_TOKEN                  = full-admin token (backward compatible).
//   - MCP_AGENT_TOKENS (JSON)    = {"<token>": {"agentId","scopes","recallLimit"}}
//     scopes ∈ read|write|recall|admin. recallLimit caps how many negative
//     memories a low-trust agent may pull. (Crypto-grade Macaroons + Ed25519
//     signing are the documented graduation; this is the pragmatic 80%.)
// ---------------------------------------------------------------------------

/** Per-tool minimum scope. */
const TOOL_SCOPE: Record<string, 'read' | 'write'> = {
  zdesign_generate: 'write',
  zdesign_cream: 'write',
  zdesign_batch: 'write',
  zdesign_concepts: 'write',
  zdesign_list_projects: 'read',
  zdesign_get_project: 'read',
  zdesign_recall_anti_patterns: 'read',
};

export interface AuthContext {
  agentId: string;
  admin: boolean;
  scopes: string[];
  recallLimit: number;
}

const ADMIN_CONTEXT: AuthContext = {
  agentId: 'admin',
  admin: true,
  scopes: ['admin', 'read', 'write', 'recall'],
  recallLimit: 100,
};

let _agentTokensCache: { value: Record<string, Partial<AuthContext> & { agentId?: string }>; env: string } | null = null;
function parseAgentTokens(): Record<string, Partial<AuthContext> & { agentId?: string }> {
  const raw = process.env.MCP_AGENT_TOKENS ?? '';
  if (_agentTokensCache?.env === raw) return _agentTokensCache.value;
  let value: Record<string, Partial<AuthContext> & { agentId?: string }> = {};
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') value = parsed as typeof value;
    } catch {
      value = {};
    }
  }
  _agentTokensCache = { value, env: raw };
  return value;
}

/** Pull the bearer token out of an Authorization header (or accept a raw token). */
function extractBearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const trimmed = authHeader.trim();
  if (!trimmed) return null;
  const bearer = /^Bearer\s+(.+)$/i.exec(trimmed)?.[1]?.trim();
  return bearer && bearer.length > 0 ? bearer : trimmed;
}

/** Resolve an Authorization header to an AuthContext, or null (unknown token). */
export function resolveAuth(authHeader: string | null): AuthContext | null {
  const tok = extractBearer(authHeader);
  if (!tok) return null;
  const admin = process.env.MCP_TOKEN;
  if (admin && tok === admin) return { ...ADMIN_CONTEXT };
  const map = parseAgentTokens();
  const entry = map[tok];
  if (!entry) return null;
  return {
    agentId: entry.agentId ?? 'agent',
    admin: !!entry.admin,
    scopes: Array.isArray(entry.scopes) ? entry.scopes : ['recall'],
    recallLimit: typeof entry.recallLimit === 'number' && entry.recallLimit > 0 ? entry.recallLimit : 25,
  };
}

/** Returns true when the request is authorized. DEFAULT-DENY unless
 *  MCP_OPEN_DEV=1 (explicit dev opt-in) or a valid token is present. */
export function isAuthorized(authHeader: string | null): boolean {
  if (process.env.MCP_OPEN_DEV === '1') return true;
  return resolveAuth(authHeader) !== null;
}

/** Reject loopback-only hosts. Returns true when the host header looks like
 *  localhost / 127.0.0.1 / [::1] / or a bare port. */
export function isLoopbackHost(hostHeader: string | null): boolean {
  if (!hostHeader) return true; // let Next.js default; route can also be behind a proxy
  const host = hostHeader.split(':')[0].toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
}

// ---------------------------------------------------------------------------
// JSON-RPC handling.
// ---------------------------------------------------------------------------

function makeResponse(res: JsonRpcResponse): string {
  return JSON.stringify(res);
}

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): string {
  return makeResponse({ jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } });
}

function resultResponse(id: string | number | null, result: unknown): string {
  return makeResponse({ jsonrpc: '2.0', id, result });
}

/** Handle a single JSON-RPC request object. Returns the JSON string of the
 *  response (empty string for notifications, which get no response). */
async function handleRequest(req: JsonRpcRequest, auth?: AuthContext): Promise<string> {
  const id = req.id ?? null;
  const method = req.method;

  // notifications (no id) get no response per JSON-RPC spec
  const isNotification = req.id === undefined;

  try {
    switch (method) {
      case 'initialize': {
        return resultResponse(id, {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        });
      }
      case 'initialized':
      case 'notifications/initialized': {
        // notification — no response
        return '';
      }
      case 'ping': {
        return resultResponse(id, {});
      }
      case 'tools/list': {
        return resultResponse(id, { tools: TOOLS });
      }
      case 'tools/call': {
        const params = (req.params ?? {}) as Record<string, unknown>;
        const toolName = typeof params.name === 'string' ? params.name : '';
        const toolArgs =
          (params.arguments && typeof params.arguments === 'object'
            ? (params.arguments as Record<string, unknown>)
            : {});
        if (!toolName) {
          return errorResponse(id, ERR_INVALID_PARAMS, 'tools/call requires { name }');
        }
        try {
          const result = await dispatchTool(toolName, toolArgs, auth);
          // Wrap as MCP tool result content (text block).
          const text = typeof result === 'string' ? result : JSON.stringify(result);
          return resultResponse(id, {
            content: [{ type: 'text', text }],
            isError: false,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'tool dispatch failed';
          return resultResponse(id, {
            content: [{ type: 'text', text: `Error: ${msg}` }],
            isError: true,
          });
        }
      }
      default: {
        if (isNotification) return '';
        return errorResponse(id, ERR_METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'internal error';
    return errorResponse(id, ERR_INTERNAL, msg);
  }
}

/** The main entrypoint. Accepts the raw request body string + auth/host info,
 *  returns { status, body, contentType }. Designed to be called from a thin
 *  Next.js route handler (see ../app/api/mcp/route.ts). */
export async function handleMcpRequest(opts: {
  body: string;
  authHeader: string | null;
  hostHeader: string | null;
}): Promise<{ status: number; body: string; contentType: string }> {
  const { body, authHeader, hostHeader } = opts;

  // 1) Loopback-only.
  if (!isLoopbackHost(hostHeader)) {
    return {
      status: 404,
      body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Not found' } }),
      contentType: 'application/json',
    };
  }

  // 2) Auth — DEFAULT-DENY. Resolve the auth context once (used both for the
  //    gate and for per-tool scope/recall-limit enforcement downstream).
  const auth = process.env.MCP_OPEN_DEV === '1' ? ADMIN_CONTEXT : resolveAuth(authHeader);
  if (!auth) {
    return {
      status: 401,
      body: JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized' } }),
      contentType: 'application/json',
    };
  }

  // 3) Parse JSON-RPC.
  let parsed: unknown;
  try {
    parsed = body.trim() ? JSON.parse(body) : null;
  } catch {
    return {
      status: 400,
      body: errorResponse(null, ERR_PARSE_ERROR, 'Parse error'),
      contentType: 'application/json',
    };
  }

  // Batch request (array): handle each, drop notification empties.
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return {
        status: 400,
        body: errorResponse(null, ERR_INVALID_REQUEST, 'Invalid Request'),
        contentType: 'application/json',
      };
    }
    const responses = await Promise.all(
      parsed.map((item) => handleRequest(item as JsonRpcRequest, auth)),
    );
    const filtered = responses.filter((r) => r !== '');
    return {
      status: 200,
      body: filtered.length === 1 ? filtered[0] : `[${filtered.join(',')}]`,
      contentType: 'application/json',
    };
  }

  if (parsed === null || typeof parsed !== 'object') {
    return {
      status: 400,
      body: errorResponse(null, ERR_INVALID_REQUEST, 'Invalid Request'),
      contentType: 'application/json',
    };
  }

  const req = parsed as JsonRpcRequest;
  if (typeof req.method !== 'string') {
    return {
      status: 400,
      body: errorResponse(null, ERR_INVALID_REQUEST, 'Invalid Request'),
      contentType: 'application/json',
    };
  }

  const respBody = await handleRequest(req, auth);
  // Notifications produce '' — HTTP 202, no body.
  if (respBody === '') {
    return { status: 202, body: '', contentType: 'application/json' };
  }
  return { status: 200, body: respBody, contentType: 'application/json' };
}

export { TOOLS, SERVER_INFO, PROTOCOL_VERSION };
