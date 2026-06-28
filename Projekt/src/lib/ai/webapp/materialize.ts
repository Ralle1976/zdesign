/**
 * webapp/materialize.ts — write a WebappProject manifest to a runnable Next.js
 * tree under data/webapps/<id>/. Uses the hand-written scaffold templates
 * (scaffold.ts) with the manifest's models/content/theme injected. The tree is
 * then build-able + runnable (the function gate verifies next build + smoke).
 *
 * Pure file I/O. Never throws on a single file — collects errors so the caller
 * (the orchestrator's checkFunction) sees the full picture.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { WebappProject } from './types';
import * as S from './scaffold';

// NOTE: materialize OUTSIDE Projekt/ — nesting inside it makes Next infer Projekt/
// as the workspace root (multiple lockfiles) and resolve modules from
// Projekt/node_modules (which lacks next-auth/bcryptjs/etc). A sibling dir is a
// standalone project with its own node_modules, so the materialized tree builds.
const WEBAPPS_ROOT = join(process.cwd(), '..', 'webapps');

export function materialize(manifest: WebappProject): { path: string; files: string[]; errors: string[] } {
  const root = join(WEBAPPS_ROOT, manifest.id);
  const files: string[] = [];
  const errors: string[] = [];
  const write = (rel: string, content: string) => {
    try {
      const abs = join(root, rel);
      mkdirSync(abs.replace(/[^/]+$/, ''), { recursive: true });
      writeFileSync(abs, content, 'utf8');
      files.push(rel);
    } catch (e) {
      errors.push(`${rel}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  // config + env
  write('package.json', S.pkgJson(manifest));
  write('next.config.mjs', S.nextConfig);
  write('tsconfig.json', S.tsConfig);
  write('.env', `DATABASE_URL="file:./dev.db"\nAUTH_SECRET="zdesign-webapp-${manifest.id}"\nWEBAPP_ADMIN_PASSWORD="demo1234"\nNEXTAUTH_URL="http://localhost:3000"\n`);
  write('.env.example', S.envExample());
  write('next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n');

  // prisma
  write('prisma/schema.prisma', S.prismaSchema(manifest));
  write('prisma/seed.ts', S.prismaSeed(manifest));

  // lib
  write('lib/db.ts', S.libDb);
  write('lib/auth.ts', S.libAuth(manifest));

  // app shell
  write('app/layout.tsx', S.appLayout(manifest));
  write('app/globals.css', S.appGlobals);
  write('app/page.tsx', S.appHome(manifest));

  // auth + admin
  write('app/api/auth/[...nextauth]/route.ts', S.apiNextauth);
  write('app/admin/login/page.tsx', S.adminLogin());
  write('app/admin/page.tsx', S.adminIndex(manifest));
  // one dynamic CRUD route handles every model
  write('app/api/admin/[model]/route.ts', S.adminCrudRoute());

  manifest.materializedPath = root;
  manifest.status = 'materialized';
  return { path: root, files, errors };
}
