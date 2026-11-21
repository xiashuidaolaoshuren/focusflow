import type { DayOfWeek } from '@/types/api'

const WEEKDAY_NAMES: DayOfWeek[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
]

/** Whether the day's weekday is one of the saved Working days. */
export function isWorkingDay(date: Date, workingDays: DayOfWeek[]): boolean {
  return workingDays.includes(WEEKDAY_NAMES[date.getDay()]!)
}

export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getLocalTimeString(date = new Date()): string {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${hours}:${minutes}:${seconds}`
}

/** The minute-aligned form of a clock value: `HH:mm:00`, seconds dropped. */
export function getLocalMinuteString(date: Date | string = new Date()): string {
  const time = typeof date === 'string' ? date : getLocalTimeString(date)
  return `${time.slice(0, 5)}:00`
}

export function isValidPlanningDate(value: string | null): value is string {
  if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = Date.parse(`${value}T00:00:00`)
  return !Number.isNaN(parsed)
}

/** The calendar day after a `YYYY-MM-DD` date, computed in UTC so no local offset can shift it. */
export function nextPlanningDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year!, month! - 1, day! + 1)).toISOString().slice(0, 10)
}

/** True when a planned `YYYY-MM-DD` day falls before today's; equal-length ISO dates compare as text. */
export function isPastPlanningDate(date: string, today: string): boolean {
  return date < today
}

export function resolvePlanningDate(
  searchParam: string | null,
  now = new Date(),
): string {
  if (isValidPlanningDate(searchParam)) {
    return searchParam
  }

  return getLocalDateString(now)
}
