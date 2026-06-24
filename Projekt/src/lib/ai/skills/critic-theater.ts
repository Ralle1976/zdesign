/**
 * Critique Theater — deterministic convergence core.
 * Runs all 5 panelists IN PARALLEL, composites weighted scores, decides
 * convergence (satisfied), and merges refinements from weak panelists.
 *
 * Pure dependency injection: the model `call` fn is passed in (Fusion in prod,
 * stubs in tests). No Fusion import here.
 */
import type { ArtBrief } from '@/lib/ai/skills/art-direction';
import { PANELISTS, parsePanelist } from './panelists';
import type { PanelistResult } from './panelists';

export interface TheaterResult {
  composite: number;
  perPanelist: PanelistResult[];
  refinements: string[];
  satisfied: boolean;
  summary: string;
}

const ROLE_LABEL: Record<PanelistResult['role'], string> = {
  designer: 'Designer',
  critic: 'Critic',
  brand: 'Brand',
  a11y: 'A11y',
  copy: 'Copy',
};

type CallFn = (
  prompt: string,
  opts?: {
    maxTokens?: number;
    temperature?: number;
    /** N1: per-panelist model override (designer/critic=glm-5.2, others=glm-5-turbo). */
    model?: string;
    /** N3: force valid JSON output from the model. */
    responseFormat?: 'json_object';
  },
) => Promise<string>;

export async function runCritiqueTheater(
  html: string,
  brief: ArtBrief,
  call: CallFn,
  opts?: { threshold?: number },
): Promise<TheaterResult> {
  const threshold = opts?.threshold ?? 8.0;

  // Run all 6 panelists in parallel; tolerate per-panelist failure.
  //
  // N1 MULTI-MODELL: each panelist runs on its preferredModel — designer &
  // critic (heavy aesthetic/brief judgment) on glm-5.2, the four lighter
  // deterministic checks (brand/a11y/copy/concept) on glm-5-turbo (faster,
  // cheaper, higher concurrency). The light models running concurrently with
  // the two heavy ones means the theater's wall-clock ≈ the slowest heavy
  // call, not the sum of all six.
  //
  // N3 JSON-MODE: every panelist returns {score, refinements, summary}, so we
  // request response_format json_object → guaranteed valid JSON, no fence
  // stripping / jsonrepair needed in the happy path (parsePanelist still
  // tolerates non-JSON as a fallback if the endpoint ignores the flag).
  const raw = await Promise.all(
    PANELISTS.map(async (p) => {
      try {
        const out = await call(p.buildPrompt(html, brief), {
          maxTokens: 1200,
          temperature: 0.15,
          model: p.preferredModel,
          responseFormat: 'json_object',
        });
        const parsed = parsePanelist(p.role, out);
        return parsed ? { weight: p.weight, result: parsed } : null;
      } catch {
        return null;
      }
    }),
  );

  const present = raw.filter(
    (r): r is { weight: number; result: PanelistResult } => r !== null,
  );

  // Total failure — nothing to composite.
  if (present.length === 0) {
    return {
      composite: 0,
      perPanelist: [],
      refinements: [],
      satisfied: false,
      summary: 'Theater fehlgeschlagen',
    };
  }

  // Weighted composite, renormalized over present panelists only.
  const weightSum = present.reduce((acc, p) => acc + p.weight, 0);
  const composite =
    present.reduce((acc, p) => acc + p.result.score * p.weight, 0) /
    (weightSum > 0 ? weightSum : 1);

  const perPanelist = present.map((p) => p.result);
  const scores = perPanelist.map((p) => p.score);
  const minScore = Math.min(...scores);

  // Convergence: above threshold AND no single weak panelist below 7.
  const satisfied = composite >= threshold && minScore >= 7;

  // Refinements from every panelist scoring below 9 (dedup identical strings).
  const seen = new Set<string>();
  const refinements: string[] = [];
  for (const p of perPanelist) {
    if (p.score < 9) {
      for (const r of p.refinements) {
        const key = r.trim();
        if (key && !seen.has(key)) {
          seen.add(key);
          refinements.push(r);
        }
      }
    }
  }

  // One-line scoreboard: "Designer 7 · Critic 8 · ... → Ø 7.9".
  const order: PanelistResult['role'][] = [
    'designer',
    'critic',
    'brand',
    'a11y',
    'copy',
  ];
  const byRole = new Map(perPanelist.map((p) => [p.role, p]));
  const parts = order
    .filter((r) => byRole.has(r))
    .map((r) => `${ROLE_LABEL[r]} ${byRole.get(r)!.score}`);
  const summary = `${parts.join(' · ')} → Ø ${composite.toFixed(1)}`;

  return { composite, perPanelist, refinements, satisfied, summary };
}
