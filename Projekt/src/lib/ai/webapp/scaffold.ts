/**
 * webapp/scaffold.ts — file-content templates for the materialized webapp tree.
 *
 * A minimal but FUNCTIONAL Next.js app (BaanBurrsi-class): Prisma + NextAuth
 * Credentials (demo-login) + a home page rendering the moduleContent + dynamic
 * admin CRUD. Hand-written templates (not LLM-generated) so the materialized
 * tree builds reliably — the function gate's "no errors" depends on it.
 * materialize.ts writes these with the manifest injected.
 */
import type { WebappProject, PrismaModelSpec } from './types';

/** package.json for the materialized app. */
export function pkgJson(p: WebappProject): string {
  return JSON.stringify({
    name: p.emission.template.key,
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint', 'db:push': 'prisma db push', 'db:seed': 'bun run prisma/seed.ts' },
    dependencies: {
      next: '15.5.0', react: '19.0.0', 'react-dom': '19.0.0',
      '@prisma/client': '^6.0.0', prisma: '^6.0.0',
      'next-auth': '^5.0.0-beta.25', bcryptjs: '^2.4.3',
    },
    devDependencies: { '@types/node': '^22', '@types/react': '^19', '@types/react-dom': '^19', typescript: '^5' },
  }, null, 2);
}

/** prisma/schema.prisma — datasource + User (auth) + the manifest's models. */
export function prismaSchema(p: WebappProject): string {
  const models = p.schema.prismaModels.map((m) => modelBlock(m)).join('\n\n');
  return `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String?
  role         String   @default("ADMIN")
  createdAt    DateTime @default(now())
}

${models}
`;
}

function modelBlock(m: PrismaModelSpec): string {
  const fields = m.fields.map((f) => `  ${f.name} ${f.type}${f.optional ? '?' : ''}`).join('\n');
  return `model ${m.name} {\n${fields}\n}`;
}

/** lib/db.ts — LAZY PrismaClient via Proxy: no instantiation at import time, so
 *  Next's build page-data collection (which evaluates the module) doesn't trip
 *  "@prisma/client did not initialize yet". The client is created on first db
 *  access (runtime), never at build. */
export const libDb = `import { PrismaClient } from '@prisma/client';
const g = globalThis as unknown as { __prisma?: PrismaClient };
export const db = new Proxy({} as PrismaClient, {
  get(_t, prop: string) {
    if (!g.__prisma) g.__prisma = new PrismaClient();
    return (g.__prisma as any)[prop];
  },
});
`;

/** lib/auth.ts — NextAuth v5 Credentials + bcrypt + demo admin. */
export function libAuth(p: WebappProject): string {
  return `import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from './db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '${p.auth.signInPath}' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email || '');
        const password = String(creds?.password || '');
        const user = await db.user.findUnique({ where: { email } });
        if (user && (await bcrypt.compare(password, user.passwordHash))) {
          return { id: user.id, email: user.email, name: user.name, role: user.role };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    authorized: ({ auth, request }) => {
      const path = request.nextUrl.pathname;
      if (path.startsWith('/admin') && path !== '${p.auth.signInPath}') return !!auth?.user;
      return true;
    },
    async jwt({ token, user }) { if (user) { token.role = (user as any).role; } return token; },
    async session({ session, token }) { if (session.user) { (session.user as any).role = token.role; } return session; },
  },
});
`;
}

/** app/layout.tsx */
export function appLayout(p: WebappProject): string {
  return `import './globals.css';
export const metadata = { title: ${JSON.stringify(p.emission.template.name)}, description: ${JSON.stringify(p.brief.slice(0, 140))} };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="de"><body>{children}</body></html>);
}
`;
}

export const appGlobals = `*,*::before,*::after{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--text);background:var(--bg);line-height:1.6}
a{color:var(--accent)}nav{display:flex;gap:1rem;padding:1rem 2rem;border-bottom:1px solid #eee;align-items:center}nav strong{margin-right:auto}
.wrap{max-width:1100px;margin:0 auto;padding:2rem}section{padding:3rem 2rem;border-bottom:1px solid #eee}
.hero{text-align:center;padding:5rem 2rem;background:linear-gradient(180deg,var(--surface),var(--bg))}
.hero h1{font-size:clamp(2rem,5vw,3.5rem);margin:.2em 0} .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:1.5rem}
.card{background:var(--surface);border-radius:12px;padding:1.5rem} .price{color:var(--accent);font-weight:600}
footer{padding:2rem;text-align:center;color:var(--muted);font-size:.9rem} .btn{display:inline-block;background:var(--accent);color:#fff;padding:.7rem 1.4rem;border-radius:8px;text-decoration:none;border:0;cursor:pointer;font:inherit}
.admin{padding:2rem} table{width:100%;border-collapse:collapse} th,td{padding:.5rem;border-bottom:1px solid #eee;text-align:left}
`;

/** app/page.tsx — home: hero + moduleContent sections (catalog/gallery). */
export function appHome(p: WebappProject): string {
  const content = p.emission.moduleContent;
  const catalog = content.find((c) => c.moduleKey === 'serviceCatalog' || c.moduleKey === 'menu');
  const voucher = content.find((c) => c.moduleKey === 'voucher');
  const site = content.find((c) => c.moduleKey === 'publicWebsite');
  const heroTitle = site?.records?.[0]?.title || p.emission.template.name;
  const heroSub = site?.records?.[0]?.subtitle || p.brief.slice(0, 120);
  const nav = p.pages.filter((pg) => !pg.isAdmin && pg.path !== '/').map((pg) => `<a href="${pg.path}">${pg.title}</a>`).join(' ');

  const cards = (recs: any[], priceKey = 'priceLabel') =>
    recs.map((r) => `<div class="card"><h3>${r.name || r.title || ''}</h3>${r.description ? `<p>${r.description}</p>` : ''}${r[priceKey] || r.price ? `<div class="price">${r[priceKey] || r.price}</div>` : ''}${r.duration ? `<small>${r.duration}</small>` : ''}</div>`).join('');

  return `export const dynamic = 'force-dynamic';
const HERO_TITLE = ${JSON.stringify(heroTitle)};
const HERO_SUB = ${JSON.stringify(heroSub)};
const NAV = ${JSON.stringify(nav)};
const CATALOG_CARDS = ${JSON.stringify(cards(catalog?.records || [], 'priceLabel'))};
const VOUCHER_CARDS = ${JSON.stringify(cards(voucher?.records || [], 'price'))};

export default function Home() {
  return (<>
    <nav><strong>{HERO_TITLE}</strong><span dangerouslySetInnerHTML={{__html: NAV}} /><a className="" href="/admin/login">Login</a></nav>
    <section className="hero"><h1>{HERO_TITLE}</h1><p>{HERO_SUB}</p></section>
    {CATALOG_CARDS && <section><h2>Angebot</h2><div className="grid" dangerouslySetInnerHTML={{__html: CATALOG_CARDS}} /></section>}
    {VOUCHER_CARDS && <section><h2>Gutscheine</h2><div className="grid" dangerouslySetInnerHTML={{__html: VOUCHER_CARDS}} /></section>}
    <footer>© {new Date().getFullYear()} {HERO_TITLE}</footer>
  </>);
}
`;
}

/** app/api/auth/[...nextauth]/route.ts — note: [...nextauth] is one dir deeper, so 4 ups to root. */
export const apiNextauth = `export const dynamic = 'force-dynamic';
import { handlers } from '../../../../lib/auth';
export const { GET, POST } = handlers;
`;

/** app/admin/login/page.tsx — credentials form + demo-login. */
export function adminLogin(): string {
  return `'use client';
import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const submit = async (e: React.FormEvent) => { e.preventDefault(); setMsg(''); const r = await signIn('credentials', { email, password, redirect: false }); setMsg(r?.ok ? 'OK — weiter...' : 'Login fehlgeschlagen'); if (r?.ok) location.href = '/admin'; };
  return (<main className="admin"><h1>Login</h1><form onSubmit={submit}><p><input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required /></p><p><input type="password" placeholder="Passwort" value={password} onChange={e=>setPassword(e.target.value)} required /></p><button className="btn">Anmelden</button></form><p>{msg}</p></main>);
}
`;
}

/** app/admin/page.tsx — protected: links to admin/<model>. */
export function adminIndex(p: WebappProject): string {
  const links = p.admin.map((a) => `<li><a href="${a.basePath.replace('/api/admin', '/admin')}">${a.model}</a></li>`).join('');
  return `export const dynamic = 'force-dynamic';
export default function Admin() {
  return (<main className="admin"><h1>Admin</h1><ul dangerouslySetInnerHTML={{__html: ${JSON.stringify(links)}}} /></main>);
}
`;
}

/** app/api/admin/[model]/route.ts — dynamic CRUD for any model. */
export function adminCrudRoute(): string {
  return `export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { db } from '../../../../lib/db';

const MODELS: Record<string, any> = (globalThis as any).__webappModels || {};

export async function GET(req: NextRequest, { params }: { params: Promise<{ model: string }> }) {
  const { model } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const delegate = (db as any)[capitalize(model)] || (db as any)[model];
  if (!delegate) return NextResponse.json({ error: 'unknown model' }, { status: 404 });
  const rows = await delegate.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ model: string }> }) {
  const { model } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const delegate = (db as any)[capitalize(model)] || (db as any)[model];
  if (!delegate) return NextResponse.json({ error: 'unknown model' }, { status: 404 });
  const row = await delegate.create({ data: body });
  return NextResponse.json({ row });
}

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
`;
}

/** prisma/seed.ts — admin (bcrypt) + the manifest's content seed.
 *  Tolerant: records are free-form (any[]), filtered to each model's fields,
 *  common aliases applied (name←title, priceLabel←price), slug generated, and
 *  each row wrapped so one bad row never aborts the seed. */
export function prismaSeed(p: WebappProject): string {
  const adminEmail = p.auth.adminEmail;
  const blocks = p.schema.prismaModels.map((m) => {
    const allowed = m.fields.map((f) => f.name).filter((n) => n !== 'id' && n !== 'createdAt');
    const rows = p.schema.seed.find((s) => s.model === m.name)?.rows || [];
    return `  // seed ${m.name} (${rows.length} rows)
  for (const _row of ${JSON.stringify(rows)} as any[]) {
    const _d: Record<string, any> = {};
    for (const _k of ${JSON.stringify(allowed)}) if (_row[_k] !== undefined) _d[_k] = _row[_k];
    if (_d.name === undefined && _row.title !== undefined) _d.name = _row.title;
    if (_d.priceLabel === undefined && _row.price !== undefined) _d.priceLabel = String(_row.price);
    if (_d.slug === undefined) _d.slug = String(_row.slug || _row.id || _d.name || _d.title || _d.code || Math.random().toString(36).slice(2));
    try { await (db as any).${m.name}.upsert({ where: { slug: _d.slug }, create: _d, update: {} }); } catch (e) { console.warn('seed ${m.name} skip', _d.slug, (e as Error).message); }
  }`;
  }).join('\n');
  return `import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const db = new PrismaClient();
async function main() {
  const pw = process.env.WEBAPP_ADMIN_PASSWORD || 'demo1234';
  await db.user.upsert({ where: { email: ${JSON.stringify(adminEmail)} }, create: { email: ${JSON.stringify(adminEmail)}, passwordHash: await bcrypt.hash(pw, 12), name: 'Admin', role: 'SUPER_ADMIN' }, update: {} }).catch(() => {});
${blocks}
}
main().catch(console.error).finally(() => db.$disconnect());
`;
}

/** .env.example */
export function envExample(): string {
  return `DATABASE_URL="file:./dev.db"\nWEBAPP_ADMIN_PASSWORD="demo1234"\nAUTH_SECRET="change-me"\nNEXTAUTH_URL="http://localhost:3000"\n`;
}

/** next.config + tsconfig (minimal). */
export const nextConfig = `export default { reactStrictMode: false };\n`;
export const tsConfig = JSON.stringify({
  compilerOptions: { target: 'es2022', lib: ['dom', 'dom.iterable', 'esnext'], module: 'esnext', moduleResolution: 'bundler', jsx: 'preserve', strict: false, esModuleInterop: true, skipLibCheck: true, noEmit: true, paths: { '@/*': ['./*'] } },
  include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
}, null, 2);
