/**
 * webapp/assemble.ts — turn a NextGenEmission into a full WebappProject manifest.
 *
 * Deterministic mapping (no LLM): the emission's requiredModules → Prisma models,
 * a multi-page route scaffold, NextAuth demo-login auth, per-module admin CRUD,
 * and the AI-driveable API route surface. The emission's moduleContent becomes
 * the seed data. This is the BaanBurrsi-class functional shape, parameterized by
 * the vertical's modules — not invented per call.
 */
import type { ModuleKey } from '@/lib/ai/nextgen/contracts';
import type { NextGenEmission } from '@/lib/ai/nextgen/contracts';
import type {
  WebappProject,
  BackendSpec,
  PrismaModelSpec,
  PageSpec,
  AuthSpec,
  AdminSpec,
  ApiRouteSpec,
} from './types';

/** module → Prisma model + standard fields. Every seeded model has `slug @unique`
 *  (the seed's upsert key) + content fields optional, so free-form moduleContent
 *  maps in without schema-mismatch failures. */
const MODULE_MODEL: Partial<Record<ModuleKey, { model: string; fields: PrismaModelSpec['fields'] }>> = {
  serviceCatalog: {
    model: 'Treatment',
    fields: [
      { name: 'id', type: 'String @id @default(cuid())' },
      { name: 'slug', type: 'String @unique' },
      { name: 'name', type: 'String?' },
      { name: 'description', type: 'String?' },
      { name: 'duration', type: 'String?' },
      { name: 'priceLabel', type: 'String?' },
      { name: 'category', type: 'String?' },
      { name: 'active', type: 'Boolean @default(true)' },
      { name: 'order', type: 'Int @default(0)' },
      { name: 'createdAt', type: 'DateTime @default(now())' },
    ],
  },
  menu: {
    model: 'MenuItem',
    fields: [
      { name: 'id', type: 'String @id @default(cuid())' },
      { name: 'slug', type: 'String @unique' },
      { name: 'name', type: 'String?' },
      { name: 'description', type: 'String?' },
      { name: 'price', type: 'String?' },
      { name: 'category', type: 'String?' },
      { name: 'active', type: 'Boolean @default(true)' },
      { name: 'createdAt', type: 'DateTime @default(now())' },
    ],
  },
  voucher: {
    model: 'Voucher',
    fields: [
      { name: 'id', type: 'String @id @default(cuid())' },
      { name: 'slug', type: 'String @unique' },
      { name: 'title', type: 'String?' },
      { name: 'name', type: 'String?' },
      { name: 'description', type: 'String?' },
      { name: 'value', type: 'String?' },
      { name: 'price', type: 'String?' },
      { name: 'priceLabel', type: 'String?' },
      { name: 'active', type: 'Boolean @default(true)' },
      { name: 'createdAt', type: 'DateTime @default(now())' },
    ],
  },
  booking: {
    model: 'Booking',
    fields: [
      { name: 'id', type: 'String @id @default(cuid())' },
      { name: 'slug', type: 'String @unique' },
      { name: 'name', type: 'String?' },
      { name: 'title', type: 'String?' },
      { name: 'email', type: 'String?' },
      { name: 'service', type: 'String?' },
      { name: 'date', type: 'String?' },
      { name: 'time', type: 'String?' },
      { name: 'status', type: 'String @default("pending")' },
      { name: 'note', type: 'String?' },
      { name: 'createdAt', type: 'DateTime @default(now())' },
    ],
  },
  media: {
    model: 'Media',
    fields: [
      { name: 'id', type: 'String @id @default(cuid())' },
      { name: 'slug', type: 'String @unique' },
      { name: 'url', type: 'String?' },
      { name: 'alt', type: 'String?' },
      { name: 'type', type: 'String @default("image")' },
      { name: 'createdAt', type: 'DateTime @default(now())' },
    ],
  },
};

const PLURAL: Record<string, string> = {
  Treatment: 'treatments',
  MenuItem: 'menu-items',
  Voucher: 'vouchers',
  Booking: 'bookings',
  Media: 'media',
};

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'item';
}

export function assemble(
  emission: NextGenEmission,
  creamHtml: string,
  brief: string,
  id: string,
): WebappProject {
  const t = emission.template;
  const modules = t.requiredModules;
  const has = (m: ModuleKey) => modules.includes(m);

  // ── backend: Prisma models + seed (from moduleContent) ──
  const prismaModels: PrismaModelSpec[] = [];
  const seed: BackendSpec['seed'] = [];
  const contentByModule = new Map(emission.moduleContent.map((mc) => [mc.moduleKey, mc.records]));
  for (const m of modules) {
    const def = MODULE_MODEL[m];
    if (!def) continue;
    prismaModels.push({ name: def.model, moduleKey: m, fields: def.fields });
    const records = (contentByModule.get(m) || []).map((r, i) => ({
      ...r,
      slug: r.slug || slugify(String(r.name || r.title || `${def.model}-${i}`)),
    }));
    if (records.length) seed.push({ model: def.model, rows: records });
  }

  // ── pages (route scaffold) ──
  const pages: PageSpec[] = [{ path: '/', title: t.name, moduleKey: 'publicWebsite', role: 'home' }];
  pages.push({ path: '/about', title: 'Über uns', role: 'about' });
  if (has('serviceCatalog')) pages.push({ path: '/leistungen', title: 'Leistungen', moduleKey: 'serviceCatalog', model: 'Treatment', role: 'catalog' });
  if (has('menu')) pages.push({ path: '/speisekarte', title: 'Speisekarte', moduleKey: 'menu', model: 'MenuItem', role: 'catalog' });
  if (has('voucher')) pages.push({ path: '/gutscheine', title: 'Gutscheine', moduleKey: 'voucher', model: 'Voucher', role: 'catalog' });
  if (has('booking')) pages.push({ path: '/buchung', title: 'Buchung', moduleKey: 'booking', role: 'booking' });
  if (has('media')) pages.push({ path: '/galerie', title: 'Galerie', moduleKey: 'media', model: 'Media', role: 'gallery' });
  pages.push({ path: '/kontakt', title: 'Kontakt', role: 'contact' });
  if (has('legalPrivacy')) {
    pages.push({ path: '/impressum', title: 'Impressum', role: 'legal' });
    pages.push({ path: '/datenschutz', title: 'Datenschutz', role: 'legal' });
  }
  for (const model of prismaModels) {
    pages.push({ path: `/admin/${PLURAL[model.name] || slugify(model.name)}`, title: `Admin · ${model.name}`, moduleKey: model.moduleKey, model: model.name, isAdmin: true, role: 'admin' });
  }

  // ── auth (NextAuth Credentials + demo-login, BaanBurrsi pattern) ──
  const auth: AuthSpec = {
    strategy: 'nextauth-credentials',
    adminEmail: `admin@${slugify(t.name)}.de`,
    adminPasswordEnv: 'WEBAPP_ADMIN_PASSWORD',
    demoLoginEnabled: true,
    signInPath: '/admin/login',
  };

  // ── admin CRUD resources ──
  const admin: AdminSpec[] = prismaModels.map((m) => ({
    moduleKey: m.moduleKey,
    model: m.name,
    basePath: `/api/admin/${PLURAL[m.name] || slugify(m.name)}`,
    operations: ['list', 'create', 'update', 'delete'],
  }));

  // ── API routes (the AI-driveable surface) ──
  const apiRoutes: ApiRouteSpec[] = [];
  for (const m of prismaModels) {
    const base = `/api/admin/${PLURAL[m.name] || slugify(m.name)}`;
    apiRoutes.push({ path: base, methods: ['GET', 'POST'], moduleKey: m.moduleKey, isAdmin: true, description: `List/create ${m.name}` });
    apiRoutes.push({ path: `${base}/[id]`, methods: ['GET', 'PATCH', 'DELETE'], moduleKey: m.moduleKey, isAdmin: true, description: `Read/update/delete one ${m.name}` });
  }
  if (has('booking')) apiRoutes.push({ path: '/api/bookings', methods: ['POST'], moduleKey: 'booking', isAdmin: false, description: 'Public booking request' });
  apiRoutes.push({ path: '/api/auth/[...nextauth]', methods: ['GET', 'POST'], description: 'NextAuth sign-in/session' });

  return {
    id,
    brief,
    verticalKey: t.verticalKey,
    tenantKey: t.tenantKey,
    status: 'draft',
    createdAt: new Date().toISOString(),
    emission,
    schema: { prismaModels, seed },
    pages,
    auth,
    admin,
    apiRoutes,
    designFamily: t.designFamilies[0] || ({} as WebappProject['designFamily']),
    creamHtml,
    review: [],
  };
}
