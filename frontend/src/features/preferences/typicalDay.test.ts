import { describe, expect, it } from 'vitest'

import { typicalDay, type TypicalDayInput } from '@/features/preferences/typicalDay'

const base: TypicalDayInput = {
  workDayStart: '09:00',
  workDayEnd: '10:30',
  bufferMinutes: 0,
  cadenceEnabled: true,
  targetFocusMinutes: 50,
  breakMinutes: 10,
  minSessionMinutes: 15,
  fixedBreaks: [],
  peakStart: null,
  peakEnd: null,
}

function kinds(input: TypicalDayInput) {
  const result = typicalDay(input)
  if (result == null) {
    throw new Error('expected a typical day')
  }
  return result.plan.composedRail.map((block) => [
    block.kind,
    block.startTime,
    block.endTime,
  ])
}

describe('typicalDay', () => {
  it('chunks focus into target-length sessions with cadence breaks between them', () => {
    expect(kinds(base)).toEqual([
      ['WORK', '09:00:00', '09:50:00'],
      ['CADENCE_BREAK', '09:50:00', '10:00:00'],
      ['WORK', '10:00:00', '10:30:00'],
    ])
  })

  it('places no cadence break when cadence is off', () => {
    const blocks = kinds({ ...base, cadenceEnabled: false })

    expect(blocks.map(([kind]) => kind)).not.toContain('CADENCE_BREAK')
    expect(blocks).toEqual([
      ['WORK', '09:00:00', '09:50:00'],
      ['WORK', '09:50:00', '10:30:00'],
    ])
  })

  it('splits the day around fixed breaks, keeps the trailing buffer, and totals focus', () => {
    const input: TypicalDayInput = {
      ...base,
      workDayEnd: '12:00',
      bufferMinutes: 30,
      cadenceEnabled: false,
      targetFocusMinutes: 60,
      fixedBreaks: [{ label: 'Lunch', startTime: '10:00', endTime: '10:30' }],
    }
    const result = typicalDay(input)

    expect(kinds(input)).toEqual([
      ['WORK', '09:00:00', '10:00:00'],
      ['FIXED_BREAK', '10:00:00', '10:30:00'],
      ['WORK', '10:30:00', '11:30:00'],
      ['BUFFER', '11:30:00', '12:00:00'],
    ])
    expect(result).toMatchObject({ focusMinutes: 120, sessions: 2 })
  })

  it('names an unlabelled fixed break so the rail can still show it', () => {
    const result = typicalDay({
      ...base,
      cadenceEnabled: false,
      fixedBreaks: [{ label: '  ', startTime: '09:30', endTime: '10:00' }],
    })

    expect(result?.plan.composedRail).toContainEqual(
      expect.objectContaining({ kind: 'FIXED_BREAK', label: 'Fixed break' }),
    )
  })

  it('returns null when the work day ends before it starts', () => {
    expect(typicalDay({ ...base, workDayEnd: '08:00' })).toBeNull()
    expect(typicalDay({ ...base, workDayEnd: '09:00' })).toBeNull()
  })
})
