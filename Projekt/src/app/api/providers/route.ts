/**
 * /api/providers — Provider registry for the agentic HTML mode (file-based).
 *
 * GET  → full registry: every provider with live configured/maskedKey status,
 *        plus the current selection from data/provider-config.json.
 * POST → update the active selection ({textProviderId, imageProviderId} and/or
 *        per-provider {enabled,model} overrides) → writes provider-config.json.
 *
 * This replaces the old DB-backed route (Prisma aIProvider, never in the schema).
 * Keys are read from env; selection lives on disk under data/.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  PROVIDERS,
  getProviderById,
  toStatus,
  readConfig,
  writeConfig,
  type ProviderConfigFile,
} from '@/lib/ai/provider-config';

// GET — full registry + current selection
export async function GET() {
  try {
    const config = await readConfig();
    const providers = PROVIDERS.map(toStatus);
    return NextResponse.json({
      providers,
      selection: {
        textProviderId: config.textProviderId,
        imageProviderId: config.imageProviderId,
      },
      overrides: config.overrides,
    });
  } catch (error) {
    console.error('[providers] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to read provider registry.' },
      { status: 500 },
    );
  }
}

// POST — update active selection / overrides
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { textProviderId, imageProviderId, overrides } = body;

  // Validate selection fields when provided.
  if (typeof textProviderId !== 'undefined') {
    if (typeof textProviderId !== 'string' || !getProviderById(textProviderId)) {
      return NextResponse.json(
        { error: `Unknown textProviderId: ${String(textProviderId)}` },
        { status: 400 },
      );
    }
  }
  if (typeof imageProviderId !== 'undefined') {
    if (typeof imageProviderId !== 'string' || !getProviderById(imageProviderId)) {
      return NextResponse.json(
        { error: `Unknown imageProviderId: ${String(imageProviderId)}` },
        { status: 400 },
      );
    }
  }

  // Validate override keys.
  if (typeof overrides !== 'undefined') {
    if (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides)) {
      return NextResponse.json(
        { error: 'overrides must be an object.' },
        { status: 400 },
      );
    }
    for (const key of Object.keys(overrides as Record<string, unknown>)) {
      if (!getProviderById(key)) {
        return NextResponse.json(
          { error: `Unknown provider in overrides: ${key}` },
          { status: 400 },
        );
      }
    }
  }

  try {
    const current = await readConfig();
    const next: ProviderConfigFile = {
      textProviderId:
        typeof textProviderId === 'string' ? textProviderId : current.textProviderId,
      imageProviderId:
        typeof imageProviderId === 'string' ? imageProviderId : current.imageProviderId,
      overrides:
        overrides && typeof overrides === 'object'
          ? (overrides as ProviderConfigFile['overrides'])
          : current.overrides,
    };
    await writeConfig(next);
    return NextResponse.json({
      selection: {
        textProviderId: next.textProviderId,
        imageProviderId: next.imageProviderId,
      },
      overrides: next.overrides,
    });
  } catch (error) {
    console.error('[providers] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to write provider config.' },
      { status: 500 },
    );
  }
}
