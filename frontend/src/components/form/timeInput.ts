export function parseTimeInput(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return null
  }

  const colonMatch = /^(\d{1,2}):(\d{2})$/.exec(trimmed)
  if (colonMatch) {
    const hours = Number(colonMatch[1])
    const minutes = Number(colonMatch[2])
    if (!isValidTime(hours, minutes)) {
      return null
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 3 || digits.length > 4) {
    return null
  }

  const padded = digits.length === 3 ? `0${digits}` : digits
  const hours = Number(padded.slice(0, 2))
  const minutes = Number(padded.slice(2, 4))
  if (!isValidTime(hours, minutes)) {
    return null
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

const STEP_FALLBACK_MINUTES = 9 * 60
const MIN_OF_DAY = 0
const MAX_OF_DAY = 23 * 60 + 55

/** ArrowUp/ArrowDown: 5 minutes, or 60 with Shift, rounded to a 5-minute grid and clamped to the day. */
export function stepTime(current: string, direction: 1 | -1, shift: boolean): string {
  const parsed = parseTimeInput(current)
  const base = parsed === null ? STEP_FALLBACK_MINUTES : toMinuteOfDay(parsed)
  const step = (shift ? 60 : 5) * direction
  const next = Math.min(MAX_OF_DAY, Math.max(MIN_OF_DAY, Math.round((base + step) / 5) * 5))
  return formatMinuteOfDay(next)
}

function toMinuteOfDay(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function formatMinuteOfDay(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function isValidTime(hours: number, minutes: number): boolean {
  return (
    Number.isInteger(hours) &&
    Number.isInteger(minutes) &&
    hours >= 0 &&
    hours <= 23 &&
    minutes >= 0 &&
    minutes <= 59
  )
}
