// Z.Design — MCP HTTP transport route (S4).
//
// Mounts the minimal MCP server (src/mcp/server.ts) at /api/mcp as a
// Streamable-HTTP endpoint. This route is intentionally thin: it forwards the
// raw body + Authorization/Host headers to handleMcpRequest() and returns the
// JSON-RPC response verbatim. All protocol/auth logic lives in the server
// module so it can be unit-tested without spinning up the Next.js runtime.

import { NextRequest, NextResponse } from 'next/server';
import { handleMcpRequest } from '@/mcp/server';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const authHeader = request.headers.get('authorization');
  const hostHeader = request.headers.get('host');

  const { status, body: respBody, contentType } = await handleMcpRequest({
    body,
    authHeader,
    hostHeader,
  });

  return new NextResponse(respBody, {
    status,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    },
  });
}

// GET /api/mcp — report server info so a client can probe the endpoint without
// a JSON-RPC envelope. Useful for ad-hoc curl checks.
export async function GET() {
  return NextResponse.json(
    {
      server: 'zdesign-mcp',
      transport: 'streamable-http',
      endpoint: '/api/mcp',
      methods: ['initialize', 'ping', 'tools/list', 'tools/call'],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
