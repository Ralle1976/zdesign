// Z.Design - API Health Check & Root Route
//
// Returns a lightweight health marker and points clients to the authoritative
// capabilities manifest at /api/capabilities. The old hardcoded endpoint list
// was stale (did not include auth, streaming, mcp, memory, webapp, providers,
// stats, ...) — callers should read the manifest instead.

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'Z.Design API',
    version: '1.1.0',
    description: 'AI-Powered Visual Design Platform',
    status: 'healthy',
    // The live, complete list of what the app can do — collected at request
    // time, never hardcoded. Includes features, providers, routes, db + auth.
    capabilities: '/api/capabilities',
    timestamp: new Date().toISOString(),
  });
}
