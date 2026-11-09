const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

export function formatClock(time: string): string {
  const parts = time.split(':')
  if (parts.length < 2) {
    return time
  }
  const hours = Number(parts[0])
  const minutes = parts[1]!.slice(0, 2)
  if (!Number.isFinite(hours)) {
    return time
  }
  return `${String(hours).padStart(2, '0')}:${minutes}`
}

export function formatDateLabel(iso: string): string {
  if (iso === '') {
    return ''
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    return ''
  }
  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const utc = Date.UTC(year, monthIndex, day)
  const check = new Date(utc)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== monthIndex ||
    check.getUTCDate() !== day
  ) {
    return ''
  }
  const month = MONTH_SHORT[monthIndex]
  if (!month) {
    return ''
  }
  return `${day} ${month} ${year}`
}

export function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return '0m'
  }
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  if (hours > 0 && remainder > 0) {
    return `${hours}h ${remainder}m`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${remainder}m`
}
