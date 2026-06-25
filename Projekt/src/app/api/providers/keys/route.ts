/**
 * /api/providers/keys — manage provider API keys in .env.local.
 *
 * POST {providerId, apiKey} → appends/updates KEY=value in .env.local.
 * GET  ?providerId=<id>     → returns the MASKED key (first4 + ... + last4).
 *
 * SECURITY:
 *   - Only ever writes to .env.local (server-side, gitignored).
 *   - NEVER reads the full key back to the client. GET returns masked only.
 *   - The full key reaches the live process only after a server restart re-reads
 *     .env.local (this route writes the file; it does not inject into process.env).
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getProviderById, maskKey, readProviderKey } from '@/lib/ai/provider-config';

const ENV_PATH = path.join(process.cwd(), '.env.local');

// POST — write key to .env.local
export async function POST(request: NextRequest) {
  let body: { providerId?: unknown; apiKey?: unknown };
  try {
    body = (await request.json()) as { providerId?: unknown; apiKey?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { providerId, apiKey } = body;
  if (typeof providerId !== 'string' || !providerId.trim()) {
    return NextResponse.json({ error: 'providerId is required.' }, { status: 400 });
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    return NextResponse.json({ error: 'apiKey is required.' }, { status: 400 });
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 404 },
    );
  }
  if (!provider.envKey) {
    return NextResponse.json(
      { error: `Provider ${providerId} does not use an API key.` },
      { status: 400 },
    );
  }

  try {
    await upsertEnvEntry(provider.envKey, apiKey.trim());
    // Do NOT return the key. Confirm with the masked form only.
    return NextResponse.json({
      providerId,
      envKey: provider.envKey,
      maskedKey: maskKey(apiKey.trim()),
      saved: true,
    });
  } catch (error) {
    console.error('[providers/keys] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to write .env.local.' },
      { status: 500 },
    );
  }
}

// GET — masked key only
export async function GET(request: NextRequest) {
  const providerId = request.nextUrl.searchParams.get('providerId');
  if (!providerId) {
    return NextResponse.json(
      { error: 'providerId query param is required.' },
      { status: 400 },
    );
  }

  const provider = getProviderById(providerId);
  if (!provider) {
    return NextResponse.json(
      { error: `Unknown provider: ${providerId}` },
      { status: 404 },
    );
  }

  // SECURITY: return only the masked form. Never the raw key.
  return NextResponse.json({
    providerId,
    envKey: provider.envKey,
    maskedKey: maskKey(readProviderKey(provider)),
    configured: !!readProviderKey(provider),
  });
}

/**
 * Insert or replace a KEY=value line in .env.local.
 *
 * Strategy: read the file (if present), drop any existing line for `key`, append
 * `key=value\n`. This keeps the file valid and avoids duplicate entries across
 * repeated saves. Creates the file if it doesn't exist.
 */
async function upsertEnvEntry(key: string, value: string): Promise<void> {
  let existing = '';
  try {
    existing = await fs.readFile(ENV_PATH, 'utf-8');
  } catch {
    // File missing — start from empty.
    existing = '';
  }

  const lines = existing.split('\n');
  // Drop any prior assignment for this key (matches "KEY=" at line start).
  const filtered = lines.filter((line) => {
    const trimmed = line.trimStart();
    return !(trimmed.startsWith(`${key}=`) || trimmed === key);
  });

  // Remove trailing blank lines, then append our entry.
  while (filtered.length && filtered[filtered.length - 1].trim() === '') {
    filtered.pop();
  }
  filtered.push(`${key}=${value}`, '');

  await fs.writeFile(ENV_PATH, filtered.join('\n'), 'utf-8');
}
