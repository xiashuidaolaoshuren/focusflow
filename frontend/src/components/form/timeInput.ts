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
