import { describe, expect, it } from 'vitest'

import { buildWorkSessions } from '@/features/plans/workSessionsModel'
import { sampleTaskSnapshot, sampleWorkBlock } from '@/features/plans/planFixtures'
import type {
  LabelledBlockKind,
  ScheduledBlockResponse,
  WorkBlockResponse,
} from '@/types/api'

function work(
  id: number,
  start: string,
  end: string,
  overrides: Partial<WorkBlockResponse> = {},
): WorkBlockResponse {
  return {
    ...sampleWorkBlock,
    id,
    startTime: start,
    endTime: end,
    taskSnapshot: { ...sampleTaskSnapshot, title: `Task ${id}` },
    ...overrides,
  }
}

function labelled(
  kind: LabelledBlockKind,
  start: string,
  end: string,
): ScheduledBlockResponse {
  return {
    ...work(500, start, end),
    kind,
    sessionIndex: null,
    sessionCount: null,
    taskSnapshot: null,
    label: 'Lunch',
  } as ScheduledBlockResponse
}

describe('buildWorkSessions', () => {
  it('groups work blocks into recorded, not recorded and no longer needed', () => {
    const groups = buildWorkSessions([
      work(1, '09:00:00', '09:50:00', { outcome: 'DONE', actualMinutes: 50 }),
      work(2, '10:00:00', '10:50:00', { outcome: 'PARTLY_DONE', actualMinutes: 20 }),
      work(3, '11:00:00', '11:50:00'),
      work(4, '12:00:00', '12:50:00', { displayState: 'NO_LONGER_NEEDED' }),
      work(5, '13:00:00', '13:50:00', { outcome: 'SKIPPED' }),
    ])

    expect(groups.map((group) => group.label)).toEqual([
      'Recorded',
      'Not recorded',
      'No longer needed',
    ])
    expect(groups[0]!.items.map((item) => item.blockId)).toEqual([1, 2, 5])
    expect(groups[1]!.items.map((item) => item.blockId)).toEqual([3])
    expect(groups[2]!.items.map((item) => item.blockId)).toEqual([4])
  })

  it('reads a block without an outcome as not recorded, never as recorded', () => {
    const [group] = buildWorkSessions([work(3, '11:00:00', '11:50:00')])

    expect(group).toEqual({
      label: 'Not recorded',
      items: [
        {
          blockId: 3,
          title: 'Task 3',
          range: '11:00–11:50',
          status: { tone: 'log', text: 'Not recorded' },
          minutes: null,
        },
      ],
    })
  })

  it('keeps only work blocks, in start order, omitting empty groups', () => {
    const groups = buildWorkSessions([
      work(9, '14:00:00', '14:50:00', { outcome: 'DONE', actualMinutes: 45 }),
      labelled('FIXED_BREAK', '12:00:00', '13:00:00'),
      work(8, '09:00:00', '09:50:00', { outcome: 'DONE', actualMinutes: 50 }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]!.label).toBe('Recorded')
    expect(groups[0]!.items.map((item) => item.blockId)).toEqual([8, 9])
    expect(groups[0]!.items[1]).toMatchObject({ minutes: 45 })
  })
})
