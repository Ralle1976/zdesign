/**
 * Sanity check for feedback-collector (I1).
 * Run: bun test tests/feedback-collector.test.ts
 */
import { unlinkSync, existsSync } from 'fs'
import {
  recordFeedback,
  readFeedback,
  getFeedbackStats,
  type FeedbackSignal,
} from '../src/lib/ai/improvement/feedback-collector'

const TMP = '/tmp/zdesign-feedback-sanity.jsonl'
process.env.FEEDBACK_PATH = TMP

function setup(): void {
  try {
    if (existsSync(TMP)) unlinkSync(TMP)
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  setup()

  const signals: FeedbackSignal[] = [
    {
      timestamp: 1_000,
      skillType: 'art-direction',
      skillId: 'ad-1',
      outcome: 'success',
      metrics: { composite: 80, auditFindings: 2, tokenCost: 1500, latencyMs: 4000 },
      context: { topic: 'asian-spa', palette: 'emerald', model: 'glm-5.2' },
    },
    {
      timestamp: 2_000,
      skillType: 'art-direction',
      skillId: 'ad-2',
      outcome: 'failure',
      metrics: { composite: 40, auditFindings: 12 },
      context: { topic: 'asian-spa', palette: 'emerald' },
    },
    {
      timestamp: 3_000,
      skillType: 'panelists',
      skillId: 'pan-1',
      outcome: 'success',
      metrics: { composite: 90, latencyMs: 6000 },
      context: { topic: 'fintech', model: 'glm-5.2' },
    },
  ]

  // record 3
  for (const s of signals) {
    await recordFeedback(s)
  }

  // read back
  const read = await readFeedback()
  if (read.length !== 3) {
    throw new Error(`expected 3 signals, got ${read.length}`)
  }

  // filter: skillType
  const adOnly = await readFeedback({ skillType: 'art-direction' })
  if (adOnly.length !== 2) {
    throw new Error(`expected 2 art-direction, got ${adOnly.length}`)
  }

  // filter: outcome
  const succOnly = await readFeedback({ outcome: 'success' })
  if (succOnly.length !== 2) {
    throw new Error(`expected 2 successes, got ${succOnly.length}`)
  }

  // filter: since
  const since = await readFeedback({ since: 2_500 })
  if (since.length !== 1) {
    throw new Error(`expected 1 signal since 2500, got ${since.length}`)
  }

  // stats
  const stats = await getFeedbackStats()
  if (stats.total !== 3) throw new Error(`stats.total=${stats.total}`)
  // 2/3 success
  if (Math.abs(stats.successRate - 2 / 3) > 1e-9) {
    throw new Error(`stats.successRate=${stats.successRate}`)
  }
  // avg composite = (80+40+90)/3 = 70
  if (Math.abs(stats.avgComposite - 70) > 1e-9) {
    throw new Error(`stats.avgComposite=${stats.avgComposite}`)
  }
  // bySkill
  const ad = stats.bySkill['art-direction']
  if (!ad || ad.count !== 2) {
    throw new Error(`art-direction missing or count=${ad?.count}`)
  }
  // ad successRate = 1/2
  if (Math.abs(ad.successRate - 0.5) > 1e-9) {
    throw new Error(`ad.successRate=${ad.successRate}`)
  }
  // ad avgComposite = (80+40)/2 = 60
  if (Math.abs(ad.avgComposite - 60) > 1e-9) {
    throw new Error(`ad.avgComposite=${ad.avgComposite}`)
  }
  const pan = stats.bySkill['panelists']
  if (!pan || pan.count !== 1 || pan.successRate !== 1) {
    throw new Error(`panelists stats wrong: ${JSON.stringify(pan)}`)
  }
  // ensure private fields stripped
  if ((pan as unknown as { _succ?: number })._succ !== undefined) {
    throw new Error('private field _succ leaked into stats')
  }

  // never-throws: malformed env path shouldn't crash reads
  process.env.FEEDBACK_PATH = '/nonexistent/dir/that/does/not/exist/f.jsonl'
  const empty = await readFeedback()
  if (empty.length !== 0) throw new Error('expected empty read for bad path')
  const emptyStats = await getFeedbackStats()
  if (emptyStats.total !== 0) throw new Error('expected empty stats for bad path')

  // recordFeedback on bad path must not throw
  await recordFeedback(signals[0])

  console.log('PASS feedback-collector sanity:', JSON.stringify(stats, null, 2))
}

main()
  .then(() => {
    try {
      if (existsSync(TMP)) unlinkSync(TMP)
    } catch {
      /* ignore */
    }
    process.exit(0)
  })
  .catch((e) => {
    console.error('FAIL feedback-collector sanity:', e)
    try {
      if (existsSync(TMP)) unlinkSync(TMP)
    } catch {
      /* ignore */
    }
    process.exit(1)
  })
