export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export const WEEKDAY_SHORT = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const

export type MonthGridCell = {
  iso: string
  inMonth: boolean
}

export function parseIso(iso: string): { year: number; monthIndex: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    return null
  }
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  return { year, monthIndex, day }
}

export function isValidIsoDate(iso: string): boolean {
  const parsed = parseIso(iso)
  if (!parsed) {
    return false
  }
  const { year, monthIndex, day } = parsed
  const utc = Date.UTC(year, monthIndex, day)
  const check = new Date(utc)
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === monthIndex &&
    check.getUTCDate() === day
  )
}

function toIso(year: number, monthIndex: number, day: number): string {
  const y = String(year)
  const m = String(monthIndex + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Monday = 0 … Sunday = 6 (UTC). */
function utcWeekdayMondayZero(year: number, monthIndex: number, day: number): number {
  const dow = new Date(Date.UTC(year, monthIndex, day)).getUTCDay()
  return (dow + 6) % 7
}

export function addDays(iso: string, delta: number): string {
  const parsed = parseIso(iso)
  if (!parsed) {
    return iso
  }
  const { year, monthIndex, day } = parsed
  const next = new Date(Date.UTC(year, monthIndex, day + delta))
  return toIso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate())
}

export function addMonths(iso: string, delta: number): string {
  const parsed = parseIso(iso)
  if (!parsed) {
    return iso
  }
  const { year, monthIndex, day } = parsed
  const next = new Date(Date.UTC(year, monthIndex + delta, day))
  return toIso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate())
}

export function buildMonthGrid(year: number, monthIndex: number): MonthGridCell[] {
  const firstWeekday = utcWeekdayMondayZero(year, monthIndex, 1)
  const startIso = addDays(toIso(year, monthIndex, 1), -firstWeekday)
  const cells: MonthGridCell[] = []
  for (let i = 0; i < 42; i += 1) {
    const iso = addDays(startIso, i)
    const cell = parseIso(iso)
    cells.push({
      iso,
      inMonth: cell?.year === year && cell.monthIndex === monthIndex,
    })
  }
  return cells
}
