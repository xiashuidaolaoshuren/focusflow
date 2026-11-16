import { z } from 'zod'

import { isValidIsoDate } from '@/components/form/calendarMath'
import { parseTimeInput } from '@/components/form/timeInput'
import { DAY_OF_WEEK_ORDER, type DayOfWeek, type TaskPriority } from '@/types/api'

const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const satisfies readonly TaskPriority[]

const WORK_OUTCOMES = ['DONE', 'PARTLY_DONE', 'SKIPPED'] as const

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Enter your email.')
    .pipe(z.email('Use an email like name@example.com.')),
  username: z
    .string()
    .trim()
    .min(1, 'Enter a username.')
    .min(3, 'Use at least 3 characters.')
    .max(30, 'Use at most 30 characters.'),
  password: z
    .string()
    .min(1, 'Enter your password.')
    .min(8, 'Use at least 8 characters.'),
})

export const timeSchema = z.string().refine(
  (value) => value.trim() === '' || parseTimeInput(value) !== null,
  'Enter a valid time (HH:MM)',
)

export const dateSchema = z.string().refine(
  (value) => value.trim() === '' || isValidIsoDate(value),
  'Enter a valid date',
)

function positiveIntString(label: string, allowEmpty: boolean) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      if (!allowEmpty) {
        ctx.addIssue({ code: 'custom', message: `${label} is required` })
      }
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(parsed) || String(parsed) !== trimmed) {
      ctx.addIssue({ code: 'custom', message: `${label} must be a whole number` })
      return
    }
    if (parsed < 1) {
      ctx.addIssue({ code: 'custom', message: `${label} must be at least 1` })
    }
  })
}

function nonNegativeIntString(label: string) {
  return z.string().superRefine((value, ctx) => {
    const trimmed = value.trim()
    if (trimmed === '') {
      ctx.addIssue({ code: 'custom', message: `${label} is required` })
      return
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(parsed) || String(parsed) !== trimmed) {
      ctx.addIssue({ code: 'custom', message: `${label} must be a whole number` })
      return
    }
    if (parsed < 0) {
      ctx.addIssue({ code: 'custom', message: `${label} must be at least 0` })
    }
  })
}

function timeToMinutes(value: string): number | null {
  const normalized = parseTimeInput(value)
  if (!normalized) {
    return null
  }
  const [hours, minutes] = normalized.split(':').map(Number)
  return hours! * 60 + minutes!
}

const TASK_FORM_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required'),
  description: z.string(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_FORM_STATUSES).optional(),
  dueDate: dateSchema,
  estimatedMinutes: positiveIntString('Estimated minutes', true),
})

export const commitmentSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Title is required')
      .max(255, 'Title must be at most 255 characters'),
    commitmentDate: z
      .string()
      .refine((value) => isValidIsoDate(value), 'Date is required'),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .superRefine((value, ctx) => {
    const start = timeToMinutes(value.startTime)
    const end = timeToMinutes(value.endTime)
    if (start != null && end != null && end <= start) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'End time must be after start time',
      })
    }
  })

export const outcomeSchema = z
  .object({
    outcome: z.enum(WORK_OUTCOMES, { error: 'Outcome is required' }),
    actualMinutes: z.string(),
    reconcile: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const actual = Number.parseInt(value.actualMinutes.trim(), 10)
    const hasActual = Number.isFinite(actual)
    if (value.outcome === 'PARTLY_DONE') {
      if (!hasActual || actual <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['actualMinutes'],
          message: 'Enter actual minutes for a partly done session',
        })
      }
    }
    if (value.reconcile) {
      if (!hasActual || actual < 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['actualMinutes'],
          message: 'Enter actual minutes for reconciliation',
        })
      }
    }
  })

const dayOfWeekSchema = z.enum(
  DAY_OF_WEEK_ORDER as [DayOfWeek, ...DayOfWeek[]],
)

export const fixedBreakFormSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, 'Label is required')
      .max(255, 'Label must be at most 255 characters'),
    startTime: timeSchema,
    endTime: timeSchema,
  })
  .superRefine((value, ctx) => {
    const start = timeToMinutes(value.startTime)
    const end = timeToMinutes(value.endTime)
    if (start != null && end != null && end <= start) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'Break end must be after its start',
      })
    }
  })

export const settingsSchema = z
  .object({
    workDayStart: timeSchema,
    workDayEnd: timeSchema,
    cadenceEnabled: z.boolean(),
    targetFocusMinutes: nonNegativeIntString('Target focus minutes'),
    breakMinutes: nonNegativeIntString('Break minutes'),
    minSessionMinutes: positiveIntString('Min session minutes', false),
    bufferMinutes: nonNegativeIntString('Buffer minutes'),
    peakStart: z.string(),
    peakEnd: z.string(),
    workingDays: z
      .array(dayOfWeekSchema)
      .min(1, 'Select at least one working day'),
    fixedBreaks: z.array(fixedBreakFormSchema),
  })
  .superRefine((value, ctx) => {
    const start = timeToMinutes(value.workDayStart)
    const end = timeToMinutes(value.workDayEnd)
    if (start != null && end != null && end <= start) {
      ctx.addIssue({
        code: 'custom',
        path: ['workDayEnd'],
        message: 'Work day end must be after work day start',
      })
    }
    const peakStartSet = value.peakStart.trim() !== ''
    const peakEndSet = value.peakEnd.trim() !== ''
    if (peakStartSet !== peakEndSet) {
      ctx.addIssue({
        code: 'custom',
        path: peakStartSet ? ['peakEnd'] : ['peakStart'],
        message: 'Set both peak start and end, or leave both empty',
      })
    }
    if (peakStartSet && peakEndSet) {
      const ps = timeToMinutes(value.peakStart)
      const pe = timeToMinutes(value.peakEnd)
      if (ps != null && pe != null && pe <= ps) {
        ctx.addIssue({
          code: 'custom',
          path: ['peakEnd'],
          message: 'Peak end must be after peak start',
        })
      }
    }
  })

export type LoginFormValues = z.infer<typeof loginSchema>
export type RegisterFormValues = z.infer<typeof registerSchema>
export type TaskFormValues = z.infer<typeof taskFormSchema>
export type CommitmentFormValues = z.infer<typeof commitmentSchema>
export type OutcomeFormValues = z.infer<typeof outcomeSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
