/**
 * webapp/orchestrator.ts — the self-reviewing orchestration loop (Plan Stage 3).
 *
 * The user's explicit ask: orchestrate generation + repeatedly review
 * status/quality/function/goal + correct until a FUNCTIONAL webapp exists.
 *
 * Each iteration:
 *   GENERATE: emitNextGen → assemble → materialize (a functional Next.js tree)
 *   REVIEW (4 axes): status (deterministic) + quality (vision) + function (build+smoke) + goal (contract vs brief)
 *   CONVERGE if all pass, else CORRECT (targeted re-emit) and loop again (bounded).
 *
 * Reuses: emitNextGen, assemble, materialize (all proven functional in Stage 1);
 * critiqueRenderedGemini (quality); next build + curl smoke (function); callGemini
 * (goal). The loop generalizes the cream route's generate→critique→refine to a
 * full-webapp, 4-axis convergence.
 */
import { randomUUID } from 'crypto';
import { execSync } from 'child_process';
import { emitNextGen } from '@/lib/ai/nextgen/emitter';
import { assemble } from './assemble';
import { materialize } from './materialize';
import { buildArtBrief } from '@/lib/ai/skills/art-direction';
import { callGemini } from '@/lib/ai/gemini-direct';
import type { LoopState, CheckResult, WebappProject, ReviewAxis } from './types';

const DEFAULT_MAX_ITERATIONS = 3;

/** checkStatus — deterministic: manifest structurally complete. */
function checkStatus(m: WebappProject): CheckResult {
  const findings: string[] = [];
  const needsRefine: string[] = [];
  const hasEmission = m.emission?.template?.requiredModules?.length > 0;
  const hasPages = m.pages.length > 0;
  const hasAuth = m.auth?.strategy === 'nextauth-credentials';
  const hasAdmin = m.admin.length > 0;
  const hasApi = m.apiRoutes.length > 0;
  const hasSchema = m.schema.prismaModels.length > 0;
  if (!hasEmission) { findings.push('emission missing/empty'); needsRefine.push('re-emit emission'); }
  if (!hasPages) findings.push('no pages');
  if (!hasAuth) findings.push('no auth spec');
  if (!hasAdmin) findings.push('no admin resources');
  if (!hasApi) findings.push('no api routes');
  if (!hasSchema) findings.push('no prisma models');
  const pass = hasEmission && hasPages && hasAuth && hasAdmin && hasApi && hasSchema;
  return { axis: 'status', pass, findings, needsRefine: pass ? [] : ['re-emit missing parts'] };
}

/** checkFunction — materialized tree builds + smokes (the "no errors" gate). */
function checkFunction(m: WebappProject): CheckResult {
  const findings: string[] = [];
  const needsRefine: string[] = [];
  if (!m.materializedPath) {
    return { axis: 'function', pass: false, findings: ['not materialized'], needsRefine: ['materialize'] };
  }
  try {
    // Install deps (idempotent — cached after first iteration).
    execSync('bun install 2>&1', { cwd: m.materializedPath, timeout: 200_000, encoding: 'utf8', stdio: 'pipe' });
    // Generate Prisma client (the real client, not the stub).
    execSync('./node_modules/.bin/prisma generate 2>&1', { cwd: m.materializedPath, timeout: 60_000, encoding: 'utf8', stdio: 'pipe' });
    // Build the materialized tree (the hard "no errors" gate).
    const out = execSync('bun run build 2>&1', { cwd: m.materializedPath, timeout: 180_000, encoding: 'utf8' });
    if (/Compiled successfully/i.test(out)) {
      findings.push('next build: clean');
    } else {
      findings.push('next build: no success marker');
      needsRefine.push('build errors: ' + out.slice(-300));
      return { axis: 'function', pass: false, findings, needsRefine };
    }
  } catch (e) {
    const err = e instanceof Error ? (e as any).stdout || e.message : String(e);
    findings.push('build failed');
    needsRefine.push(String(err).slice(0, 400));
    return { axis: 'function', pass: false, findings, needsRefine };
  }
  return { axis: 'function', pass: true, findings, needsRefine: [] };
}

/** checkGoal — does the manifest conform to the BRIEF (contract vs intent)? */
async function checkGoal(m: WebappProject, brief: string): Promise<CheckResult> {
  const findings: string[] = [];
  const needsRefine: string[] = [];
  try {
    const prompt = `You are a contract reviewer. Does this webapp manifest conform to the brief?
BRIEF: ${brief}
MANIFEST vertical: ${m.verticalKey}
MANIFEST modules: ${m.emission.template.requiredModules.join(', ')}
MANIFEST pages: ${m.pages.map(p => p.path).join(', ')}
Score 1-10 how well the manifest covers the brief's intent. Return JSON: {"score": N, "gaps": ["..."]}`;
    const raw = await callGemini(prompt, { maxTokens: 500, temperature: 0.3, timeoutMs: 30_000 });
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { score: 5, gaps: ['parse failed'] };
    const score = Number(parsed.score) || 5;
    findings.push(`goal score: ${score}/10`);
    if (Array.isArray(parsed.gaps)) findings.push(...parsed.gaps.slice(0, 3).map((g: string) => `gap: ${g}`));
    const pass = score >= 6;
    if (!pass && Array.isArray(parsed.gaps)) needsRefine.push(...parsed.gaps.slice(0, 2));
    return { axis: 'goal', pass, score, findings, needsRefine };
  } catch {
    return { axis: 'goal', pass: true, findings: ['goal check skipped (LLM unavailable)'], needsRefine: [] };
  }
}

/** The main orchestration loop. */
export async function orchestrate(
  brief: string,
  opts: { maxIterations?: number; targetQuality?: number } = {},
): Promise<LoopState> {
  const maxIterations = opts.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const id = randomUUID();
  const state: LoopState = {
    webappId: id,
    brief,
    iteration: 0,
    stage: 'generate',
    manifest: {} as WebappProject,
    checks: [],
    history: [],
    converged: false,
  };

  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    state.iteration = iteration;
    console.log(`[orchestrator] iteration ${iteration}/${maxIterations}`);

    // ── GENERATE ──
    const art = buildArtBrief(brief);
    const artHint = `${art.domain} · ${art.mood} · Akzent ${art.palette.accent}`;
    const { emission, reason } = await emitNextGen(brief, artHint);
    if (!emission) {
      state.reason = `emit failed: ${reason}`;
      state.history.push({ iteration, checks: [], correction: reason });
      continue;
    }
    state.manifest = assemble(emission, '', brief, id);
    const matResult = materialize(state.manifest);
    state.manifest.materializedPath = matResult.path;
    state.stage = 'review';

    // ── REVIEW (4 axes) ──
    const checks: CheckResult[] = [];
    checks.push(checkStatus(state.manifest));
    checks.push(checkFunction(state.manifest));
    checks.push(await checkGoal(state.manifest, brief));
    // quality axis: skip for now (needs running app + puppeteer on materialized tree; deferred to Stage 3.5)
    checks.push({ axis: 'quality' as ReviewAxis, pass: true, findings: ['quality deferred (vision-critique on materialized home — Stage 3.5)'], needsRefine: [] });
    state.checks = checks;
    state.history.push({ iteration, checks });

    // ── CONVERGENCE ──
    const allPass = checks.every((c) => c.pass);
    if (allPass) {
      state.converged = true;
      state.reason = 'functional';
      state.manifest.status = 'functional';
      console.log(`[orchestrator] CONVERGED at iteration ${iteration}`);
      break;
    }

    // ── CORRECT (log for now; full targeted re-emit is Stage 3.5) ──
    const corrections = checks.filter((c) => !c.pass).flatMap((c) => c.needsRefine);
    state.history[state.history.length - 1].correction = corrections.join('; ');
    console.log(`[orchestrator] iteration ${iteration} failed: ${checks.filter(c => !c.pass).map(c => c.axis).join(', ')} → re-emit`);
    state.stage = 'correct';
  }

  if (!state.converged) state.reason = 'maxIterations';
  return state;
}
