import { describe, expect, it } from 'vitest'

import { planlessRailPlan } from '@/features/plans/planlessRail'

const preferences = {
  workDayStart: '09:00:00',
  workDayEnd: '18:00:00',
  bufferMinutes: 3,
  fixedBreaks: [{ label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' }],
  peakStart: '10:00:00',
  peakEnd: '12:00:00',
}

const commitments = [
  {
    id: 7,
    title: 'Dentist',
    commitmentDate: '2026-11-16',
    startTime: '15:00:00',
    endTime: '15:30:00',
  },
]

describe('planlessRailPlan', () => {
  it('places fixed breaks, commitments and the trailing buffer, with no work or cadence blocks', () => {
    const plan = planlessRailPlan(preferences, commitments)

    expect(plan.composedRail.map((block) => block.kind)).toEqual([
      'FIXED_BREAK',
      'COMMITMENT',
      'BUFFER',
    ])
    expect(plan.windowStart).toBe('09:00:00')
    expect(plan.windowEnd).toBe('18:00:00')
    expect(plan.peakStart).toBe('10:00:00')
    expect(plan.peakEnd).toBe('12:00:00')

    const commitment = plan.composedRail.find((block) => block.kind === 'COMMITMENT')
    expect(commitment).toMatchObject({
      label: 'Dentist',
      startTime: '15:00:00',
      endTime: '15:30:00',
    })
    const buffer = plan.composedRail.find((block) => block.kind === 'BUFFER')
    expect(buffer).toMatchObject({ startTime: '17:57:00', endTime: '18:00:00' })
  })

  it('gives every block its own id so a commitment never collides with a break', () => {
    const ids = planlessRailPlan(preferences, commitments).composedRail.map((block) => block.id)

    expect(new Set(ids).size).toBe(ids.length)
  })
})
