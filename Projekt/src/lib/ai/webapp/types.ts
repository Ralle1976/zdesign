/**
 * webapp/types.ts — the WebappProject manifest + the orchestration-loop state.
 *
 * A WebappProject is the serializable description of a complete, standalone,
 * FUNCTIONAL webapp (BaanBurrsi-class: NextAuth demo-login + Prisma backend +
 * multi-page + admin CRUD), conforming to NextGenWepApp's contract (portable to
 * it later via MCP). The orchestrator mutates one of these per iteration.
 */
import type { NextGenEmission, DesignFamily, ModuleKey } from '@/lib/ai/nextgen/contracts';

export type WebappStatus = 'draft' | 'materialized' | 'functional' | 'failed';

/** One Prisma model in the webapp's backend (derived from a module). */
export interface PrismaModelSpec {
  name: string; // e.g. "Treatment"
  moduleKey: ModuleKey;
  fields: { name: string; type: string; optional?: boolean }[];
}

/** Seed rows for a model (real content from the emission's moduleContent). */
export interface SeedSpec {
  model: string;
  rows: Record<string, unknown>[];
}

export interface BackendSpec {
  prismaModels: PrismaModelSpec[];
  seed: SeedSpec[];
}

/** One page in the webapp (route + which module/model it binds). */
export interface PageSpec {
  path: string; // "/", "/about", "/leistungen", "/admin/leistungen", ...
  title: string;
  moduleKey?: ModuleKey;
  model?: string; // Prisma model it reads
  isAdmin?: boolean;
  /** Which layout slot / section this page fills (for the design-family). */
  role: 'home' | 'about' | 'catalog' | 'gallery' | 'booking' | 'contact' | 'legal' | 'admin' | 'custom';
}

/** NextAuth v5 Credentials auth + seed admin + one-click demo-login (BaanBurrsi pattern). */
export interface AuthSpec {
  strategy: 'nextauth-credentials';
  adminEmail: string;
  adminPasswordEnv: string; // env var name holding the seed admin password
  demoLoginEnabled: boolean;
  signInPath: string; // "/admin/login"
}

/** A per-module admin CRUD resource. */
export interface AdminSpec {
  moduleKey: ModuleKey;
  model: string;
  basePath: string; // "/api/admin/treatments"
  operations: ('list' | 'create' | 'update' | 'delete')[];
}

/** An API route the AI can drive (the api-registry surface of the webapp). */
export interface ApiRouteSpec {
  path: string;
  methods: string[];
  moduleKey?: ModuleKey;
  isAdmin?: boolean;
  description?: string;
}

export interface WebappProject {
  id: string;
  brief: string;
  verticalKey: string;
  tenantKey: string;
  status: WebappStatus;
  createdAt: string;
  /** The NextGen-contract emission (template + moduleContent) — portability to NextGenWepApp. */
  emission: NextGenEmission;
  schema: BackendSpec;
  pages: PageSpec[];
  auth: AuthSpec;
  admin: AdminSpec[];
  apiRoutes: ApiRouteSpec[];
  designFamily: DesignFamily;
  /** Z.Design cream hero HTML (design reference). */
  creamHtml: string;
  /** Path to the materialized Next.js tree (data/webapps/<id>/), if materialized. */
  materializedPath?: string;
  /** Orchestration-loop verdict history. */
  review: ReviewVerdict[];
}

// ── Orchestration loop ────────────────────────────────────────────────
export type ReviewAxis = 'status' | 'quality' | 'function' | 'goal';
export type Stage = 'generate' | 'assemble' | 'review' | 'correct';

export interface CheckResult {
  axis: ReviewAxis;
  pass: boolean;
  score?: number;
  findings: string[];
  needsRefine: string[];
}

export interface ReviewVerdict {
  iteration: number;
  checks: CheckResult[];
  correction?: string;
}

export interface LoopState {
  webappId: string;
  brief: string;
  iteration: number;
  stage: Stage;
  manifest: WebappProject;
  checks: CheckResult[];
  history: ReviewVerdict[];
  converged: boolean;
  reason?: string; // 'functional' | 'maxIterations' | error
}
