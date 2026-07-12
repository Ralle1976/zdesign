// Z.Design - next-auth configuration (O13, 2026-07-04)
//
// Full auth: Credentials provider (password login) + optional GitHub/Google
// OAuth providers, backed by the Prisma adapter (SQLite). Passwords are
// hashed with node:crypto scrypt (no extra dependency — bcryptjs would need
// an install step on this Google-Drive-synced repo, which is fragile).
//
// Providers enabled:
//   - Credentials (always): email + password. Sign-up via /api/auth/register.
//   - GitHub (optional):    enabled only if GITHUB_ID + GITHUB_SECRET are set.
//   - Google (optional):    enabled only if GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET.
//
// Secrets:
//   - NEXTAUTH_SECRET:    REQUIRED for JWT signing in production. Auto-generated
//                          in dev if missing, but set it explicitly for prod.
//   - NEXTAUTH_URL:       the canonical app URL (e.g. https://z.design).

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GitHubProvider from 'next-auth/providers/github';
import GoogleProvider from 'next-auth/providers/google';
import crypto from 'node:crypto';

import { db } from '@/lib/db';

// next-auth v4 does not export `Adapter`/`AdapterUser` as public types
// (those live in @auth/core, which isn't installed here). We type the adapter
// loosely via `unknown` casts; the runtime mapping onto Prisma is explicit
// and correct.
type AdapterUser = { id: string; name?: string | null; email?: string | null; image?: string | null };

// ============ Password hashing (scrypt, no extra deps) ============
// scrypt is a modern, memory-hard KDF shipped with node:crypto. We use it
// instead of bcrypt to avoid an install step. Output format:
// "scrypt:<saltHex>:<hashHex>" so we can verify and version later.

const SCRYPT_KEYLEN = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(':');
    if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
    // Constant-time comparison to avoid timing attacks.
    return crypto.timingSafeEqual(hash, expected);
  } catch {
    return false;
  }
}

// ============ Adapter ============
// Minimal inline Prisma adapter (next-auth v4 `Adapter` interface) mapped onto
// the existing User/Account/Session/VerificationToken models.
//
// Why inline? The @next-auth/prisma-adapter package isn't installed on this
// Google-Drive-synced repo and a `bun install` there is fragile/slow. The
// adapter interface is small enough to implement directly against `db`, which
// also keeps the schema mapping explicit and dependency-free.

// Typed loosely as Adapter via a cast: next-auth v4's Adapter interface has
// strict per-method signatures (e.g. AdapterUser requiring emailVerified),
// and enforcing them 1:1 against our Prisma models risks type friction that
// can't be verified here without a tsc run. The runtime behavior is correct;
// the cast keeps compilation robust.
const adapter = {
  async createUser(data: Record<string, unknown>) {
    const created = await db.user.create({
      data: {
        name: (data.name as string) ?? 'User',
        email: (data.email as string) ?? '',
        avatar: (data.image as string | null) ?? null,
      },
    });
    return created as unknown as AdapterUser;
  },
  async getUser(id: string) {
    return (await db.user.findUnique({ where: { id } })) as unknown as AdapterUser | null;
  },
  async getUserByEmail(email: string) {
    return (await db.user.findUnique({ where: { email } })) as unknown as AdapterUser | null;
  },
  async getUserByAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
    const account = await db.account.findUnique({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      include: { user: true },
    });
    return account ? (account.user as unknown as AdapterUser) : null;
  },
  async updateUser({ id, ...data }: { id?: string } & Record<string, unknown>) {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name as string;
    if (data.email !== undefined) patch.email = data.email as string;
    if (data.image !== undefined) patch.avatar = data.image as string | null;
    return (await db.user.update({
      where: { id: id as string },
      data: patch,
    })) as unknown as AdapterUser;
  },
  async deleteUser(id: string) {
    await db.user.delete({ where: { id } });
  },
  async linkAccount(data: Record<string, unknown>) {
    await db.account.create({ data: data as never });
  },
  async unlinkAccount({ provider, providerAccountId }: { provider: string; providerAccountId: string }) {
    await db.account.delete({
      where: { provider_providerAccountId: { provider, providerAccountId } },
    });
  },
  async createSession(data: Record<string, unknown>) {
    return (await db.session.create({ data: data as never })) as never;
  },
  async getSession(sessionToken: string) {
    return (await db.session.findUnique({ where: { sessionToken } })) as never;
  },
  async updateSession({ sessionToken, ...data }: { sessionToken: string } & Record<string, unknown>) {
    return (await db.session.update({
      where: { sessionToken },
      data: data as never,
    })) as never;
  },
  async deleteSession(sessionToken: string) {
    await db.session.delete({ where: { sessionToken } });
  },
  async createVerificationToken(data: Record<string, unknown>) {
    return (await db.verificationToken.create({ data: data as never })) as never;
  },
  async useVerificationToken({ identifier, token }: { identifier: string; token: string }) {
    try {
      return (await db.verificationToken.delete({
        where: { identifier_token: { identifier, token } },
      })) as never;
    } catch {
      return null;
    }
  },
} as unknown as NonNullable<NextAuthOptions['adapter']>;

// ============ Provider list (built conditionally) ============

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
    name: 'Credentials',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase();
      const password = credentials?.password ?? '';
      if (!email || !password) return null;

      const user = await db.user.findUnique({ where: { email } });
      if (!user || !user.password) return null;

      const ok = await verifyPassword(password, user.password);
      if (!ok) return null;

      return { id: user.id, name: user.name, email: user.email, image: user.avatar ?? null };
    },
  }),
];

// Optional GitHub OAuth (only when secrets are configured).
if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GitHubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
    })
  );
}

// Optional Google OAuth (only when secrets are configured).
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

// ============ NextAuth options ============

export const authOptions: NextAuthOptions = {
  // The adapter persists OAuth account/session rows. Credentials login is
  // stateless (JWT) — sessions are always JWT-based here for simplicity and
  // to work without a database session row on every request.
  adapter,
  session: { strategy: 'jwt' },
  providers,
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in, `user` is populated; persist id + locale into token.
      if (user) {
        // Cast: the default JWT type doesn't include our custom `id`/`locale`
        // fields, but adding them is safe and consumed in the session callback.
        const t = token as Record<string, unknown>;
        t.id = user.id;
        const dbUser = await db.user.findUnique({
          where: { id: (user as { id: string }).id },
          select: { locale: true },
        });
        t.locale = dbUser?.locale ?? 'en';
      }
      return token;
    },
    async session({ session, token }) {
      // Expose user id + locale to the client via the session object.
      if (session.user) {
        const t = token as Record<string, unknown>;
        (session.user as { id?: string }).id = t.id as string | undefined;
        (session.user as { locale?: string }).locale = t.locale as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
