import { describe, expect, it } from 'vitest'

import {
  buildUnplannedWorkRequest,
  canSubmitUnplannedWork,
  type UnplannedWorkDraft,
} from '@/features/plans/unplannedWorkModel'

const TODAY = '2026-06-15'

function draft(overrides: Partial<UnplannedWorkDraft> = {}): UnplannedWorkDraft {
  return {
    taskId: 10,
    taskRemainingMinutes: 25,
    effortVersion: 2,
    workDate: TODAY,
    actualMinutes: '10',
    finish: false,
    reassess: false,
    checkpointMinutes: '',
    today: TODAY,
    ...overrides,
  }
}

describe('canSubmitUnplannedWork', () => {
  it('needs a task', () => {
    expect(canSubmitUnplannedWork(draft({ taskId: null }))).toBe(false)
  })

  it('needs positive actual minutes', () => {
    expect(canSubmitUnplannedWork(draft({ actualMinutes: '' }))).toBe(false)
    expect(canSubmitUnplannedWork(draft({ actualMinutes: '0' }))).toBe(false)
  })

  it('rejects a work date after the client date', () => {
    expect(canSubmitUnplannedWork(draft({ workDate: '2026-06-16' }))).toBe(false)
  })

  it('accepts a past work date', () => {
    expect(canSubmitUnplannedWork(draft({ workDate: '2026-06-14' }))).toBe(true)
  })

  it('blocks a save that would exhaust the remainder until Finish is ticked', () => {
    const exhausting = draft({ actualMinutes: '30', taskRemainingMinutes: 25 })
    expect(canSubmitUnplannedWork(exhausting)).toBe(false)
    expect(canSubmitUnplannedWork({ ...exhausting, finish: true })).toBe(true)
  })

  it('accepts an exhausting save once a positive reassessment is entered', () => {
    const exhausting = draft({
      actualMinutes: '30',
      taskRemainingMinutes: 25,
      reassess: true,
      checkpointMinutes: '5',
    })
    expect(canSubmitUnplannedWork(exhausting)).toBe(true)
  })

  it('does not block when the remainder is unknown', () => {
    expect(
      canSubmitUnplannedWork(draft({ actualMinutes: '500', taskRemainingMinutes: null })),
    ).toBe(true)
  })
})

describe('buildUnplannedWorkRequest', () => {
  it('sends the task effort version and the client date', () => {
    expect(buildUnplannedWorkRequest(draft({ workDate: '2026-06-14' }))).toEqual({
      taskId: 10,
      workDate: '2026-06-14',
      actualMinutes: 10,
      currentDate: TODAY,
      effortVersion: 2,
      finish: false,
      checkpoint: null,
    })
  })

  it('sends a checkpoint only when reassessing with a positive value', () => {
    expect(
      buildUnplannedWorkRequest(
        draft({ reassess: true, checkpointMinutes: '7' }),
      ).checkpoint,
    ).toEqual({ remainingEffortMinutes: 7 })
  })

  it('sends finish without a checkpoint', () => {
    const request = buildUnplannedWorkRequest(draft({ finish: true }))
    expect(request.finish).toBe(true)
    expect(request.checkpoint).toBeNull()
  })
})
