// Z.Design — Auth Guard for sensitive API routes
//
// Pragmatic auth for provider/design routes that can trigger API costs or
// overwrite secrets. Uses a bearer credential from ZDESIGN_ADMIN_TOKEN env var.
// In production, replace with next-auth getServerSession + role check.

import { NextRequest, NextResponse } from 'next/server';

export function requireAdmin(request: NextRequest): NextResponse | null {
  const adminSecret = process.env.ZDESIGN_ADMIN_TOKEN;
  // If no credential configured, allow in dev mode.
  // In production, block if not configured.
  if (!adminSecret) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Server admin credential not configured' }, { status: 500 });
    }
    return null; // dev mode: allow
  }
  const authHeader = request.headers.get('authorization') || '';
  const bearerValue = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (bearerValue !== adminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null; // authorized
}

