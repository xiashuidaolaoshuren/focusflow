import { describe, expect, it } from 'vitest'

import { revisionBlocks } from '@/features/plans/revisionView'
import { samplePlan } from '@/features/plans/planFixtures'

describe('revisionBlocks', () => {
  it('returns the composed rail for the current view', () => {
    expect(revisionBlocks(samplePlan, null)).toBe(samplePlan.composedRail)
  })

  it('returns the blocks of the chosen revision', () => {
    const revision = samplePlan.revisions[0]!
    expect(revisionBlocks(samplePlan, revision.id)).toBe(revision.blocks)
  })

  it('falls back to the composed rail for an unknown revision', () => {
    expect(revisionBlocks(samplePlan, 9999)).toBe(samplePlan.composedRail)
  })
})
