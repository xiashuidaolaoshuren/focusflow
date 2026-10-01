import { describe, expect, it } from 'vitest'

import { sampleTaskSnapshot } from '@/features/plans/planFixtures'
import { parseScheduledBlock } from '@/features/plans/blocks'
import type { ScheduledBlockResponse } from '@/types/api'

const workBlock: ScheduledBlockResponse = {
  kind: 'WORK',
  startTime: '09:00:00',
  endTime: '09:45:00',
  sessionIndex: 1,
  sessionCount: 1,
  taskSnapshot: sampleTaskSnapshot,
  label: null,
}

const labelledBlock: ScheduledBlockResponse = {
  kind: 'BUFFER',
  startTime: '17:45:00',
  endTime: '18:00:00',
  sessionIndex: null,
  sessionCount: null,
  taskSnapshot: null,
  label: 'Buffer',
}

describe('parseScheduledBlock', () => {
  it('accepts a valid work block', () => {
    expect(parseScheduledBlock(workBlock)).toBe(workBlock)
  })

  it('accepts a valid labelled block', () => {
    expect(parseScheduledBlock(labelledBlock)).toBe(labelledBlock)
  })

  it('rejects a work block without a task snapshot', () => {
    const invalid = { ...workBlock, taskSnapshot: null } as unknown as ScheduledBlockResponse
    expect(() => parseScheduledBlock(invalid)).toThrow(/work block/i)
  })

  it('rejects a work block carrying a label', () => {
    const invalid = { ...workBlock, label: 'Should not label work' } as unknown as ScheduledBlockResponse
    expect(() => parseScheduledBlock(invalid)).toThrow(/work block/i)
  })

  it('rejects a work block without session numbering', () => {
    const invalid = {
      ...workBlock,
      sessionIndex: null,
      sessionCount: null,
    } as unknown as ScheduledBlockResponse
    expect(() => parseScheduledBlock(invalid)).toThrow(/work block/i)
  })

  it('rejects a labelled block without a label', () => {
    const invalid = { ...labelledBlock, label: null } as unknown as ScheduledBlockResponse
    expect(() => parseScheduledBlock(invalid)).toThrow(/non-work block/i)
  })

  it('rejects a labelled block carrying a task snapshot', () => {
    const invalid = {
      ...labelledBlock,
      taskSnapshot: sampleTaskSnapshot,
    } as unknown as ScheduledBlockResponse
    expect(() => parseScheduledBlock(invalid)).toThrow(/non-work block/i)
  })
})