// Z.Design - Registration endpoint (O13, 2026-07-04)
// POST /api/auth/register { name, email, password }
// Creates a User with a hashed password for the Credentials provider.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { name, email, password } = await request.json();

    if (
      typeof name !== 'string' || name.trim().length < 2 ||
      typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== 'string' || password.length < 8
    ) {
      return NextResponse.json(
        { error: 'Invalid input. Name ≥ 2 chars, valid email, password ≥ 8 chars required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const hashed = await hashPassword(password);
    await db.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        password: hashed,
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error('[Register API] Error:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
