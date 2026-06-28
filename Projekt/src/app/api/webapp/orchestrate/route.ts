// Z.Design — WebApp orchestrate (Plan Stage 3): the self-reviewing loop entry.
//
// POST /api/webapp/orchestrate { brief, maxIterations?, target? }
//   → orchestrate(brief, opts) → LoopState { iteration, checks, converged, reason }
//
// The loop: emit → assemble → materialize → review (status/quality/function/goal)
// → correct → repeat, bounded by maxIterations, until functional.
import { NextRequest, NextResponse } from 'next/server';
import { orchestrate } from '@/lib/ai/webapp/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
    if (!brief) return NextResponse.json({ error: 'brief (string) required' }, { status: 400 });
    const maxIterations = Number(body.maxIterations) > 0 ? Number(body.maxIterations) : undefined;
    const targetQuality = Number(body.target) > 0 ? Number(body.target) : undefined;

    const state = await orchestrate(brief, { maxIterations, targetQuality });
    return NextResponse.json({
      webappId: state.webappId,
      converged: state.converged,
      reason: state.reason,
      iterations: state.iteration,
      finalChecks: state.checks.map((c) => ({ axis: c.axis, pass: c.pass, score: c.score, findings: c.findings.slice(0, 2) })),
      manifestSummary: {
        vertical: state.manifest.verticalKey,
        modules: state.manifest.emission?.template?.requiredModules || [],
        pages: state.manifest.pages?.length || 0,
        models: state.manifest.schema?.prismaModels?.map((m) => m.name) || [],
        materializedPath: state.manifest.materializedPath,
      },
      history: state.history.map((h) => ({
        iteration: h.iteration,
        passes: h.checks.filter((c) => c.pass).length + '/' + h.checks.length,
        correction: h.correction?.slice(0, 120),
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'orchestrate failed';
    console.error('[webapp/orchestrate] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
