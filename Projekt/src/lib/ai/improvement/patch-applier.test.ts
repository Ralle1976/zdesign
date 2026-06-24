// patch-applier.test.ts — sanity-check the approval gate (I4)
import { describe, it, expect, beforeEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  applyPatch,
  approvePatch,
  processPendingPatches,
  rejectPatch,
  revertPatch,
  readPatches,
} from './patch-applier'
import { makePatch, SkillPatch } from './patch-proposer'

// Each test points PATCHES_PATH at a fresh temp JSONL so tests are isolated.
let tmpDir: string
let patchesFile: string

function freshStore(seed: SkillPatch[] = []): void {
  tmpDir = mkdtempSync(join(tmpdir(), 'patches-'))
  patchesFile = join(tmpDir, 'patches.jsonl')
  process.env.PATCHES_PATH = patchesFile
  if (seed.length > 0) {
    writeFileSync(
      patchesFile,
      seed.map((p) => JSON.stringify(p)).join('\n') + '\n',
      'utf8',
    )
  }
}

describe('patch-applier approval gate', () => {
  beforeEach(() => {
    freshStore()
  })

  it('AUTO-APPLIES a 0.85-confidence, sampleSize>=5 patch', async () => {
    const patch = makePatch({
      skill: 'art-direction',
      type: 'guidance',
      summary: 'Prefer warmer neutrals on wellness topics',
      confidence: 0.85,
      sampleSize: 12,
    })
    const res = await applyPatch(patch)
    expect(res.applied).toBe(true)
    expect(res.reason).toContain('auto-applied')

    const stored = readPatches()
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe('applied')
    expect(stored[0].version).toBe(2) // created at v1, bumped on apply
  })

  it('LEAVES PENDING a 0.6-confidence patch (below threshold)', async () => {
    const patch = makePatch({
      skill: 'creative-director',
      type: 'token',
      summary: 'Swap emerald for deep teal',
      confidence: 0.6,
      sampleSize: 8,
    })
    const res = await applyPatch(patch)
    expect(res.applied).toBe(false)
    expect(res.reason).toContain('left pending')
    expect(res.reason).toContain('confidence')

    const stored = readPatches()
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe('proposed')
  })

  it('LEAVES PENDING when sampleSize < 5 even at high confidence', async () => {
    const patch = makePatch({
      skill: 'panelists',
      type: 'weight',
      summary: 'Bump UX panelist weight',
      confidence: 0.9,
      sampleSize: 3,
    })
    const res = await applyPatch(patch)
    expect(res.applied).toBe(false)
    expect(res.reason).toContain('sampleSize')
  })

  it('REJECTS a pending patch via rejectPatch', async () => {
    const patch = makePatch({
      skill: 'art-direction',
      type: 'recipe',
      summary: 'Fold in spa-layout recipe',
      confidence: 0.55,
      sampleSize: 4,
    })
    await applyPatch(patch) // left pending
    await rejectPatch(patch.id)
    const stored = readPatches()
    expect(stored).toHaveLength(1)
    expect(stored[0].status).toBe('rejected')
    expect(stored[0].version).toBe(2) // proposed(1) -> rejected(2)
  })

  it('APPROVES a pending patch via approvePatch', async () => {
    const patch = makePatch({
      skill: 'refine',
      type: 'guidance',
      summary: 'Tighten critique specificity',
      confidence: 0.7,
      sampleSize: 6,
    })
    await applyPatch(patch) // left pending
    await approvePatch(patch.id)
    const stored = readPatches()
    expect(stored[0].status).toBe('approved')
  })

  it('REVERTS an applied patch via revertPatch', async () => {
    const patch = makePatch({
      skill: 'art-direction',
      type: 'guardrail',
      summary: 'Relax max-saturation guardrail',
      confidence: 0.88,
      sampleSize: 7,
    })
    await applyPatch(patch) // auto-applied
    expect(readPatches()[0].status).toBe('applied')
    await revertPatch(patch.id)
    const stored = readPatches()
    expect(stored[0].status).toBe('reverted')
    expect(stored[0].reason).toContain('effectiveness')
  })

  it('processPendingPatches applies eligible, leaves the rest', async () => {
    const strong = makePatch({
      skill: 'art-direction',
      type: 'guidance',
      summary: 'strong patch',
      confidence: 0.92,
      sampleSize: 20,
    })
    const weak = makePatch({
      skill: 'art-direction',
      type: 'guidance',
      summary: 'weak patch',
      confidence: 0.5,
      sampleSize: 2,
    })
    // Seed both as proposed directly into the store.
    freshStore([strong, weak])
    const res = await processPendingPatches()
    expect(res.autoApplied).toBe(1)
    expect(res.leftPending).toBe(1)

    const stored = readPatches()
    const strongRow = stored.find((p) => p.id === strong.id)!
    const weakRow = stored.find((p) => p.id === weak.id)!
    expect(strongRow.status).toBe('applied')
    expect(weakRow.status).toBe('proposed')
  })

  it('rejectPatch on unknown id is a no-op (no throw)', async () => {
    await rejectPatch('does-not-exist')
    expect(readPatches()).toHaveLength(0)
  })
})
