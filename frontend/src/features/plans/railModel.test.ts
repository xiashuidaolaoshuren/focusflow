import { describe, expect, it } from 'vitest'

import { buildRail } from '@/features/plans/railModel'
import { sampleTaskSnapshot, samplePlan } from '@/features/plans/planFixtures'
import type {
  DailyPlanResponse,
  LabelledBlockKind,
  ScheduledBlockResponse,
  WorkBlockResponse,
} from '@/types/api'

let nextId = 1

function work(
  startTime: string,
  endTime: string,
  overrides: Partial<WorkBlockResponse> = {},
): WorkBlockResponse {
  return {
    kind: 'WORK',
    startTime,
    endTime,
    sessionIndex: 1,
    sessionCount: 1,
    taskSnapshot: { ...sampleTaskSnapshot, title: 'Write report' },
    label: null,
    id: nextId++,
    revisionId: 1,
    outcome: null,
    actualMinutes: null,
    reconciled: false,
    progressVersion: 0,
    displayState: 'ACTIONABLE',
    ...overrides,
  }
}

function labelled(
  kind: LabelledBlockKind,
  startTime: string,
  endTime: string,
  label: string,
): ScheduledBlockResponse {
  return {
    kind,
    startTime,
    endTime,
    sessionIndex: null,
    sessionCount: null,
    taskSnapshot: null,
    label,
    id: nextId++,
    revisionId: 1,
    outcome: null,
    actualMinutes: null,
    reconciled: false,
    progressVersion: 0,
    displayState: 'ACTIONABLE',
  }
}

function planWith(blocks: ScheduledBlockResponse[]): DailyPlanResponse {
  return {
    ...samplePlan,
    windowStart: '09:00:00',
    windowEnd: '18:00:00',
    peakStart: null,
    peakEnd: null,
    composedRail: blocks,
  }
}

const dayBlocks = [
  work('09:00:00', '09:50:00'),
  labelled('CADENCE_BREAK', '09:50:00', '10:00:00', 'Cadence break'),
  labelled('FIXED_BREAK', '12:00:00', '13:00:00', 'Lunch'),
  labelled('COMMITMENT', '14:00:00', '15:00:00', 'Dentist'),
  labelled('BUFFER', '17:30:00', '18:00:00', 'Trailing buffer'),
]

describe('buildRail', () => {
  it('produces one block per kind', () => {
    const rail = buildRail(planWith(dayBlocks), null, 'comfortable')

    expect(rail.blocks.map((block) => block.kind)).toEqual([
      'WORK',
      'CADENCE_BREAK',
      'FIXED_BREAK',
      'COMMITMENT',
      'BUFFER',
    ])
  })

  it('positions blocks from the window start at 1.6 px per minute', () => {
    const rail = buildRail(
      planWith([
        work('09:00:00', '09:50:00'),
        work('09:30:00', '10:00:00'),
      ]),
      null,
      'comfortable',
    )

    expect(rail.blocks[0]).toMatchObject({ topPx: 0, heightPx: 78 })
    expect(rail.blocks[1]).toMatchObject({ topPx: 48, heightPx: 46 })
  })

  it('names a work block with its title, range and session', () => {
    const rail = buildRail(
      planWith([
        work('09:00:00', '09:50:00', { sessionIndex: 2, sessionCount: 3 }),
        work('10:00:00', '10:50:00'),
        labelled('FIXED_BREAK', '12:00:00', '13:00:00', 'Lunch'),
      ]),
      null,
      'comfortable',
    )
    const [split, single, fixed] = rail.blocks

    expect(split).toMatchObject({
      title: 'Write report',
      range: '09:00–09:50',
      sessionLabel: 'session 2 of 3',
      label: 'Work: Write report, 09:00–09:50, session 2 of 3',
    })
    expect(single!.sessionLabel).toBeNull()
    expect(single!.label).toBe('Work: Write report, 10:00–10:50')
    expect(fixed).toMatchObject({
      title: 'Lunch',
      label: 'Fixed break: Lunch, 12:00–13:00',
    })
  })

  it('collapses short blocks to a row and keeps their title in the name', () => {
    const rail = buildRail(
      planWith([
        work('09:00:00', '09:15:00'),
        work('10:00:00', '11:00:00'),
      ]),
      null,
      'comfortable',
    )
    const [short, long] = rail.blocks

    expect(short!.layout).toBe('row')
    expect(short!.label).toContain('Write report')
    expect(long!.layout).toBe('stack')
  })

  it('gives 5 and 10 minute blocks room for one readable line in both densities', () => {
    // 20px fits a single line of the row layout; below it the title is clipped.
    const plan = planWith([
      work('09:00:00', '09:05:00'),
      work('10:00:00', '10:10:00'),
    ])

    for (const density of ['comfortable', 'compact'] as const) {
      const [five, ten] = buildRail(plan, null, density).blocks
      expect(five!.heightPx).toBeGreaterThanOrEqual(20)
      expect(ten!.heightPx).toBeGreaterThanOrEqual(20)
    }
  })

  it('summarises outcomes as text with a tone', () => {
    const rail = buildRail(
      planWith([
        work('09:00:00', '09:30:00', { outcome: 'DONE', actualMinutes: 30 }),
        work('09:30:00', '10:00:00', { outcome: 'PARTLY_DONE', actualMinutes: 20 }),
        work('10:00:00', '10:30:00', { outcome: 'SKIPPED' }),
        work('10:30:00', '11:00:00', { displayState: 'NO_LONGER_NEEDED' }),
        work('11:00:00', '11:30:00'),
        labelled('COMMITMENT', '14:00:00', '15:00:00', 'Dentist'),
      ]),
      11 * 60 + 45,
      'comfortable',
    )

    expect(rail.blocks.map((block) => block.outcome)).toEqual([
      { tone: 'done', text: 'Done' },
      { tone: 'partly', text: 'Partly · 20 of 30m' },
      { tone: 'skipped', text: 'Skipped' },
      { tone: 'gone', text: 'No longer needed' },
      { tone: 'log', text: 'Log outcome' },
      { tone: 'commitment', text: 'Unavailable' },
    ])
    expect(rail.blocks[0]!.label).toBe('Work: Write report, 09:00–09:30, Done')
  })

  it('shows no outcome on a future block or a break', () => {
    const rail = buildRail(
      planWith([
        work('15:00:00', '15:30:00'),
        labelled('FIXED_BREAK', '12:00:00', '13:00:00', 'Lunch'),
      ]),
      9 * 60,
      'comfortable',
    )

    expect(rail.blocks.map((block) => block.outcome)).toEqual([null, null])
  })

  it('places the now-line at the supplied minute', () => {
    const plan = planWith(dayBlocks)

    const inside = buildRail(plan, 10 * 60 + 30, 'comfortable')
    expect(inside.nowTopPx).toBe(90 * 1.6)
    expect(inside.nowLabel).toBe('10:30')

    expect(buildRail(plan, 10 * 60 + 30, 'compact').nowTopPx).toBe(90 * 1.2)
    expect(buildRail(plan, 8 * 60, 'comfortable').nowTopPx).toBeNull()
    expect(buildRail(plan, 19 * 60, 'comfortable').nowTopPx).toBeNull()
    expect(buildRail(plan, null, 'comfortable')).toMatchObject({
      nowTopPx: null,
      nowLabel: null,
    })
  })

  it('marks the block that crosses now as in progress', () => {
    const rail = buildRail(
      planWith([
        work('13:30:00', '14:20:00'),
        work('14:20:00', '15:00:00'),
        work('12:30:00', '13:30:00', { outcome: 'DONE', actualMinutes: 60 }),
      ]),
      14 * 60,
      'comfortable',
    )
    const [current, later, done] = rail.blocks

    expect(current).toMatchObject({
      isCurrent: true,
      outcome: { tone: 'current', text: 'In progress · 20m left' },
    })
    expect(later!.isCurrent).toBe(false)
    expect(done!.isCurrent).toBe(false)
  })

  it('lays out hour marks, the peak window and the total height', () => {
    const plan = {
      ...planWith(dayBlocks),
      peakStart: '09:30:00',
      peakEnd: '12:00:00',
    }
    const rail = buildRail(plan, null, 'comfortable')

    expect(rail.hours).toHaveLength(10)
    expect(rail.hours[0]).toMatchObject({ label: '09:00', topPx: 0 })
    expect(rail.hours[9]).toMatchObject({ label: '18:00', topPx: 540 * 1.6 })
    expect(rail.peak).toEqual({ topPx: 30 * 1.6, heightPx: 150 * 1.6 })
    expect(rail.totalPx).toBe(540 * 1.6)
    expect(buildRail(planWith(dayBlocks), null, 'comfortable').peak).toBeNull()
  })

  it('emits hairlines every half hour and flags the hour mark next to now', () => {
    const plan = { ...planWith([]), windowStart: '09:00:00', windowEnd: '11:00:00' }

    const rail = buildRail(plan, 10 * 60 + 5, 'comfortable')

    expect(rail.lines).toEqual([
      { topPx: 0, half: false },
      { topPx: 30 * 1.6, half: true },
      { topPx: 60 * 1.6, half: false },
      { topPx: 90 * 1.6, half: true },
      { topPx: 120 * 1.6, half: false },
    ])
    expect(rail.hours.map((hour) => hour.nearNow)).toEqual([false, true, false])
    expect(
      buildRail(plan, null, 'comfortable').hours.every((hour) => !hour.nearNow),
    ).toBe(true)
  })

  it('starts hour marks at the first whole hour inside the window', () => {
    const rail = buildRail(
      { ...planWith([]), windowStart: '09:30:00', windowEnd: '11:15:00' },
      null,
      'comfortable',
    )

    expect(rail.hours.map((hour) => hour.label)).toEqual(['10:00', '11:00'])
    expect(rail.hours[0]!.topPx).toBe(30 * 1.6)
  })

  it('uses 1.2 px per minute when compact without changing the block count', () => {
    const plan = planWith([work('09:00:00', '09:50:00'), ...dayBlocks.slice(1)])
    const comfortable = buildRail(plan, null, 'comfortable')
    const compact = buildRail(plan, null, 'compact')

    expect(compact.blocks).toHaveLength(comfortable.blocks.length)
    expect(compact.blocks[0]).toMatchObject({ topPx: 0, heightPx: 58 })
    expect(compact.blocks[0]!.heightPx).toBeLessThan(comfortable.blocks[0]!.heightPx)
  })

  it('uses 0.6 px per minute when mini without changing the block count', () => {
    const plan = planWith([work('09:00:00', '09:50:00'), ...dayBlocks.slice(1)])
    const comfortable = buildRail(plan, null, 'comfortable')
    const mini = buildRail(plan, null, 'mini')

    expect(mini.blocks).toHaveLength(comfortable.blocks.length)
    expect(mini.blocks[0]).toMatchObject({ topPx: 0, heightPx: 50 * 0.6 - 2 })
    expect(mini.totalPx).toBe(540 * 0.6)
  })
})
