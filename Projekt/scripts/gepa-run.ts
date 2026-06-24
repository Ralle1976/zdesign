/**
 * gepa-run.ts — standalone entry for the GEPA offline soul-guidance evolver.
 *
 * Run once (offline, not in the request path):
 *   bun run scripts/gepa-run.ts
 *
 * Loads FUSION_SERVICE_URL from the env, runs one optimization pass, prints
 * the result, and exits. Safe to re-run; each pass is independent.
 */
import { runGepaOptimizer } from '../src/lib/ai/gepa/optimizer'
import { callFusionText } from '../src/lib/ai/fusion/fusion-client'

async function main() {
  if (!process.env.FUSION_SERVICE_URL) {
    console.error('[gepa-run] FUSION_SERVICE_URL is not set — aborting.')
    process.exit(1)
  }
  console.log('[gepa-run] starting one GEPA optimization pass…')
  const result = await runGepaOptimizer(callFusionText)
  console.log('[gepa-run] result:', JSON.stringify(result, null, 2))
  if (result.ran) {
    console.log(
      result.kept
        ? `[gepa-run] KEPT new guidance (${result.bestScore} > ${result.oldScore}).`
        : `[gepa-run] guidance unchanged (best ${result.bestScore} <= baseline ${result.oldScore}).`,
    )
  } else {
    console.log(`[gepa-run] did not run: ${result.reason}`)
  }
}

main().catch((e) => {
  console.error('[gepa-run] fatal:', e)
  process.exit(1)
})
