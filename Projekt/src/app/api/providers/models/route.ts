/**
 * /api/providers/models — static model list for a provider.
 *
 * GET ?providerId=<id> → {providerId, models:[{id,name}, ...]} from the registry.
 * Returns 404 for an unknown providerId. The list is static per provider (defined
 * in provider-config.ts); no live API call is made.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProviderById } from '@/lib/ai/provider-config';

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

  return NextResponse.json({
    providerId: provider.id,
    defaultModel: provider.defaultModel,
    models: provider.models,
  });
}
