import { describe, expect, it } from 'vitest'

import {
  commitmentSchema,
  outcomeSchema,
  settingsSchema,
  taskFormSchema,
} from '@/components/form/schemas'

describe('taskFormSchema', () => {
  it('requires a title and validates due date and estimated minutes', () => {
    expect(taskFormSchema.safeParse({ title: '   ' }).success).toBe(false)
    expect(
      taskFormSchema.safeParse({
        title: 'Task',
        description: '',
        dueDate: '2026-02-30',
        estimatedMinutes: '',
      }).success,
    ).toBe(false)
    expect(
      taskFormSchema.safeParse({
        title: 'Task',
        description: '',
        dueDate: '',
        estimatedMinutes: '0',
      }).success,
    ).toBe(false)
    expect(
      taskFormSchema.safeParse({
        title: 'Task',
        description: '',
        dueDate: '2026-11-06',
        estimatedMinutes: '45',
      }).success,
    ).toBe(true)
  })
})

describe('commitmentSchema', () => {
  it('validates title length and time ordering', () => {
    expect(
      commitmentSchema.safeParse({
        title: 'a'.repeat(256),
        commitmentDate: '2026-11-06',
        startTime: '10:00',
        endTime: '11:00',
      }).success,
    ).toBe(false)
    expect(
      commitmentSchema.safeParse({
        title: 'Lunch',
        commitmentDate: '2026-11-06',
        startTime: '12:00',
        endTime: '11:00',
      }).success,
    ).toBe(false)
    expect(
      commitmentSchema.safeParse({
        title: 'Lunch',
        commitmentDate: '2026-11-06',
        startTime: '12:00',
        endTime: '25:00',
      }).success,
    ).toBe(false)
  })
})

describe('outcomeSchema', () => {
  it('requires outcome and validates actual minutes rules', () => {
    expect(
      outcomeSchema.safeParse({ actualMinutes: '', reconcile: false }).success,
    ).toBe(false)
    expect(
      outcomeSchema.safeParse({
        outcome: 'PARTLY_DONE',
        actualMinutes: '',
      }).success,
    ).toBe(false)
    expect(
      outcomeSchema.safeParse({
        outcome: 'DONE',
        actualMinutes: '',
      }).success,
    ).toBe(true)
  })
})

describe('settingsSchema', () => {
  it('validates session, work day, peak, and fixed breaks', () => {
    expect(
      settingsSchema.safeParse({
        workDayStart: '09:00',
        workDayEnd: '18:00',
        cadenceEnabled: true,
        targetFocusMinutes: '50',
        breakMinutes: '10',
        minSessionMinutes: '0',
        bufferMinutes: '0',
        peakStart: '',
        peakEnd: '',
        workingDays: ['MONDAY'],
        fixedBreaks: [],
      }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({
        workDayStart: '18:00',
        workDayEnd: '09:00',
        cadenceEnabled: true,
        targetFocusMinutes: '50',
        breakMinutes: '10',
        minSessionMinutes: '15',
        bufferMinutes: '0',
        peakStart: '10:00',
        peakEnd: '',
        workingDays: ['MONDAY'],
        fixedBreaks: [],
      }).success,
    ).toBe(false)
    expect(
      settingsSchema.safeParse({
        workDayStart: '09:00',
        workDayEnd: '18:00',
        cadenceEnabled: true,
        targetFocusMinutes: '50',
        breakMinutes: '10',
        minSessionMinutes: '15',
        bufferMinutes: '0',
        peakStart: '',
        peakEnd: '',
        workingDays: [],
        fixedBreaks: [
          { label: 'Lunch', startTime: '12:30', endTime: '12:00' },
        ],
      }).success,
    ).toBe(false)
  })
})
