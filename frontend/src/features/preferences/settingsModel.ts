import { DAY_OF_WEEK_ORDER, type SchedulingPreferencesRequest, type SchedulingPreferencesResponse } from '@/types/api'
import type { SettingsFormValues } from '@/components/form/schemas'
import type { TypicalDayInput } from '@/features/preferences/typicalDay'

const CLOCK_PATTERN = /^\d{2}:\d{2}$/

function toFormTime(apiTime: string): string {
  return apiTime.slice(0, 5)
}

export function toFormValues(
  preferences: SchedulingPreferencesResponse,
): SettingsFormValues {
  return {
    workDayStart: toFormTime(preferences.workDayStart),
    workDayEnd: toFormTime(preferences.workDayEnd),
    cadenceEnabled: preferences.cadenceEnabled,
    targetFocusMinutes: String(preferences.targetFocusMinutes),
    breakMinutes: String(preferences.breakMinutes),
    minSessionMinutes: String(preferences.minSessionMinutes),
    bufferMinutes: String(preferences.bufferMinutes),
    peakStart: preferences.peakStart != null ? toFormTime(preferences.peakStart) : '',
    peakEnd: preferences.peakEnd != null ? toFormTime(preferences.peakEnd) : '',
    workingDays: [...preferences.workingDays],
    fixedBreaks: preferences.fixedBreaks.map((fixedBreak) => ({
      label: fixedBreak.label,
      startTime: toFormTime(fixedBreak.startTime),
      endTime: toFormTime(fixedBreak.endTime),
    })),
  }
}

/** Turns the form's current strings into a typical-day input, or null while they are incomplete. */
export function toTypicalInput(values: SettingsFormValues): TypicalDayInput | null {
  const numbers = [
    values.targetFocusMinutes,
    values.breakMinutes,
    values.minSessionMinutes,
    values.bufferMinutes,
  ].map((raw) => (/^\d+$/.test(raw.trim()) ? Number(raw) : Number.NaN))
  if (numbers.some((value) => !Number.isFinite(value))) {
    return null
  }
  if (!CLOCK_PATTERN.test(values.workDayStart) || !CLOCK_PATTERN.test(values.workDayEnd)) {
    return null
  }
  const [targetFocusMinutes, breakMinutes, minSessionMinutes, bufferMinutes] = numbers as [
    number,
    number,
    number,
    number,
  ]
  return {
    workDayStart: values.workDayStart,
    workDayEnd: values.workDayEnd,
    bufferMinutes,
    cadenceEnabled: values.cadenceEnabled,
    targetFocusMinutes,
    breakMinutes,
    minSessionMinutes,
    fixedBreaks: values.fixedBreaks,
    peakStart: values.peakStart.trim() === '' ? null : values.peakStart,
    peakEnd: values.peakEnd.trim() === '' ? null : values.peakEnd,
  }
}

function toApiTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

/** The exact PUT body: times with seconds, a null peak when empty, working days Monday-first. */
export function toRequest(values: SettingsFormValues): SchedulingPreferencesRequest {
  return {
    workDayStart: toApiTime(values.workDayStart),
    workDayEnd: toApiTime(values.workDayEnd),
    cadenceEnabled: values.cadenceEnabled,
    targetFocusMinutes: Number(values.targetFocusMinutes),
    breakMinutes: Number(values.breakMinutes),
    minSessionMinutes: Number(values.minSessionMinutes),
    bufferMinutes: Number(values.bufferMinutes),
    peakStart: values.peakStart.trim() === '' ? null : toApiTime(values.peakStart),
    peakEnd: values.peakEnd.trim() === '' ? null : toApiTime(values.peakEnd),
    fixedBreaks: values.fixedBreaks.map((fixedBreak) => ({
      label: fixedBreak.label,
      startTime: toApiTime(fixedBreak.startTime),
      endTime: toApiTime(fixedBreak.endTime),
    })),
    workingDays: DAY_OF_WEEK_ORDER.filter((day) => values.workingDays.includes(day)),
  }
}
