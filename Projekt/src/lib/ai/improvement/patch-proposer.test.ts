// patch-proposer.test.ts — sanity-check proposePatches (I3)
import { describe, it, expect } from 'bun:test'
import {
  proposePatches,
  getPendingPatches,
  savePatch,
  makePatch,
  PROPOSAL_CONFIDENCE_THRESHOLD,
  type SkillPatch,
} from './patch-proposer'
import type { Correlation } from './correlation-engine'

describe('patch-proposer', () => {
  it('returns 2 patches with rationale for 2 strong correlations', async () => {
    const correlations: Correlation[] = [
      {
        factor: 'palette:Cormorant',
        effect: '+1.4 composite (7.8 vs 6.4 baseline) — higher',
        confidence: 0.72,
        sampleSize: 9,
        recommendation: 'Prefer palette "Cormorant" for this domain — +1.4 composite.',
      },
      {
        factor: 'concept:editorial',
        effect: '+1.1 composite (7.6 vs 6.5 baseline) — higher',
        confidence: 0.68,
        sampleSize: 6,
        recommendation: 'Keep the "editorial" concept in rotation — +1.1 uplift.',
      },
    ]

    const patches = await proposePatches(correlations)

    expect(patches).toHaveLength(2)

    // Palette patch → design-system skill, adjust-weight proposal.
    const pal = patches[0]
    expect(pal.skill).toBe('design-system')
    expect(pal.confidence).toBeGreaterThanOrEqual(PROPOSAL_CONFIDENCE_THRESHOLD)
    expect(pal.sampleSize).toBe(9)
    expect(pal.status).toBe('proposed')
    // spec-exact fields carried in payload
    expect(pal.payload.proposalType).toBe('adjust-weight')
    expect(pal.payload.old).toContain('Cormorant')
    expect(pal.payload.new).toContain('Cormorant')
    expect(typeof pal.payload.rationale).toBe('string')
    expect((pal.payload.rationale as string).length).toBeGreaterThan(0)
    expect(pal.payload.source).toBe('auto-correlation')

    // Concept patch → creative-director skill, add-keyword proposal.
    const con = patches[1]
    expect(con.skill).toBe('creative-director')
    expect(con.payload.proposalType).toBe('add-keyword')
    expect(con.payload.new).toContain('editorial')
    expect(typeof con.payload.rationale).toBe('string')
    expect((con.payload.rationale as string).length).toBeGreaterThan(0)
  })

  it('skips correlations below the confidence threshold', async () => {
    const correlations: Correlation[] = [
      {
        factor: 'palette:emerald',
        effect: '+0.4 composite (7.0 vs 6.6 baseline) — higher',
        confidence: 0.45, // below 0.6
        sampleSize: 4,
        recommendation: 'weak',
      },
      {
        factor: 'concept:editorial',
        effect: '+1.2 composite (7.7 vs 6.5 baseline) — higher',
        confidence: 0.8,
        sampleSize: 10,
        recommendation: 'strong',
      },
    ]
    const patches = await proposePatches(correlations)
    expect(patches).toHaveLength(1)
    expect(patches[0].skill).toBe('creative-director')
  })

  it('produces an audit guardrail proposal for auditFindings correlations', async () => {
    const correlations: Correlation[] = [
      {
        factor: 'auditFindings:<3',
        effect: '+1.3 composite (7.6 vs 6.3 baseline) — higher',
        confidence: 0.7,
        sampleSize: 8,
        recommendation: 'fewer findings → higher score',
      },
    ]
    const patches = await proposePatches(correlations)
    expect(patches).toHaveLength(1)
    expect(patches[0].skill).toBe('audit-suite')
    expect(patches[0].payload.proposalType).toBe('modify-threshold')
    expect(patches[0].type).toBe('guardrail') // projected onto load-bearing PatchType
  })

  it('getPendingPatches reads only proposed patches; savePatch appends', async () => {
    // Use an isolated temp store.
    const { mkdtempSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const tmpDir = mkdtempSync(join(tmpdir(), 'proposer-'))
    process.env.PATCHES_PATH = join(tmpDir, 'patches.jsonl')

    expect(await getPendingPatches()).toHaveLength(0)

    const proposed = makePatch({
      skill: 'art-direction',
      type: 'guidance',
      summary: 'Prefer warmer neutrals',
      confidence: 0.6,
      sampleSize: 5,
    })
    const applied: SkillPatch = {
      ...makePatch({
        skill: 'art-direction',
        type: 'guidance',
        summary: 'already applied',
        confidence: 0.9,
        sampleSize: 12,
      }),
      status: 'applied',
    }

    await savePatch(proposed)
    await savePatch(applied)

    const pending = await getPendingPatches()
    expect(pending).toHaveLength(1)
    expect(pending[0].id).toBe(proposed.id)
    expect(pending[0].status).toBe('proposed')
  })
})
