import { formatClock, formatDateLabel, formatDuration } from '@/lib/format'

export function horizonRangeCopy(currentDate: string, currentTime: string): string {
  return `Seven working days from ${formatDateLabel(currentDate)} at ${formatClock(currentTime)}`
}
import type {
  HorizonDayResponse,
  HorizonSegmentResponse,
  HorizonTaskRowResponse,
  UnplacedReason,
} from '@/types/api'

const UNPLACED_REASON_LABELS: Record<UnplacedReason, string> = {
  BLOCKED: 'Blocked',
  NO_ESTIMATE: 'No estimate',
  OUT_OF_TIME: 'Out of time',
}

export function timeSpanMinutes(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start)
}

function timeToMinutes(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export type SavedPlanWindow = {
  planId: number
  windowMinutes: number
}

export function longestFullWorkWindow(
  forecastWindowMinutes: number,
  savedPlanWindows: SavedPlanWindow[],
  savedDays: HorizonDayResponse[],
): number {
  let max = forecastWindowMinutes
  for (const day of savedDays) {
    if (day.kind !== 'SAVED' || day.planId == null) {
      continue
    }
    const saved = savedPlanWindows.find((entry) => entry.planId === day.planId)
    if (saved != null && saved.windowMinutes > max) {
      max = saved.windowMinutes
    }
  }
  return Math.max(max, 1)
}

export function barPercent(minutes: number, scaleMinutes: number): number {
  if (scaleMinutes <= 0) {
    return 0
  }
  return (minutes / scaleMinutes) * 100
}

export function isDueDateColumn(dueDate: string | null, columnDates: string[]): boolean {
  if (dueDate == null) {
    return false
  }
  return columnDates.includes(dueDate)
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export type DueMarker = {
  columnDate: string
  placement: 'in' | 'edge'
  label: string
}

/**
 * Where a task's due date shows on the grid. A date that is a column shows
 * "Due" in that column. A date between two columns shows its weekday at the
 * right edge of the earlier column. Dates outside the columns show nothing.
 */
export function dueMarker(
  dueDate: string | null,
  columnDates: string[],
): DueMarker | null {
  if (dueDate == null) {
    return null
  }
  if (isDueDateColumn(dueDate, columnDates)) {
    return { columnDate: dueDate, placement: 'in', label: 'Due' }
  }
  for (let index = 0; index < columnDates.length - 1; index += 1) {
    const current = columnDates[index]!
    const next = columnDates[index + 1]!
    if (dueDate > current && dueDate < next) {
      const weekday = weekdayShort(dueDate)
      return weekday == null
        ? null
        : { columnDate: current, placement: 'edge', label: weekday }
    }
  }
  return null
}

function weekdayShort(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) {
    return null
  }
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return WEEKDAY_SHORT[new Date(utc).getUTCDay()] ?? null
}

export function formatDueDateTitle(dueDate: string | null): string | null {
  if (dueDate == null) {
    return null
  }
  const label = formatDateLabel(dueDate)
  return label === '' ? null : `Due ${label}`
}

const EXCLUSION_LABELS = {
  DEPENDENCY: 'dependency',
  CHECKPOINT: 'checkpoint',
} as const

export function segmentCellCopy(segment: HorizonSegmentResponse): string[] {
  const lines: string[] = []

  if (segment.minutes > 0 && segment.unplacedReason == null) {
    lines.push(formatDuration(segment.minutes))
  }

  if (segment.unplacedReason != null) {
    lines.push(UNPLACED_REASON_LABELS[segment.unplacedReason])
  }

  if (
    segment.unplacedScope === 'SAVED_SHORTFALL' &&
    segment.unplacedMinutes != null
  ) {
    lines.push(`Saved shortfall: ${formatDuration(segment.unplacedMinutes)}`)
  } else if (
    segment.unplacedScope === 'FORECAST' &&
    segment.unplacedMinutes != null &&
    segment.unplacedReason === 'OUT_OF_TIME'
  ) {
    lines.push(`${formatDuration(segment.unplacedMinutes)} unplaced`)
  }

  if (
    segment.assumedCreditMinutes != null &&
    segment.assumedCreditMinutes !== segment.minutes
  ) {
    const causes = segment.creditExclusions
      .map((exclusion) => EXCLUSION_LABELS[exclusion])
      .join(', ')
    const creditLine = `${formatDuration(segment.assumedCreditMinutes)} credited of ${formatDuration(segment.minutes)} displayed`
    lines.push(causes.length > 0 ? `${creditLine} (${causes})` : creditLine)
  }

  return lines
}

export function segmentAriaLabel(
  task: Pick<HorizonTaskRowResponse, 'title'>,
  segment: HorizonSegmentResponse,
  dayKind: HorizonDayResponse['kind'],
): string {
  const parts = [
    task.title,
    segment.date,
    `${segment.minutes} minutes displayed`,
  ]
  if (
    segment.assumedCreditMinutes != null &&
    segment.assumedCreditMinutes !== segment.minutes
  ) {
    parts.push(`${segment.assumedCreditMinutes} minutes credited`)
  }
  parts.push(dayKind === 'SAVED' ? 'saved day' : 'forecast day')
  return parts.join(', ')
}

export function waitingOnCopy(task: HorizonTaskRowResponse): string | null {
  if (task.waitingOn.length === 0) {
    return null
  }
  const titles = task.waitingOn.map((ref) => ref.title).join(', ')
  return `Waiting on ${titles}`
}

export const HORIZON_PACE_COPY =
  'Eligible unrecorded sessions on saved plans are assumed completed as planned; a dependency conflict or an assessment that already covers the session is excluded, and recording skipped or partly done work updates the rest of the horizon.'

export function savedConflictCopy(day: HorizonDayResponse): string | null {
  if (day.kind !== 'SAVED' || day.dependenciesIgnored.length === 0) {
    return null
  }
  return 'A saved session conflicts with a current dependency. Generating again applies the current rules, and this plan is left as saved.'
}

export function forecastHeaderCopy(): string {
  return 'Fixed order: must-continue, then due or overdue, then optional. Generating a Daily plan for this date can choose a different order inside those groups.'
}

export function todayHref(date: string): string {
  return `/today?date=${date}`
}

export function upstreamCopy(
  task: Pick<HorizonTaskRowResponse, 'upstreamBlockers'>,
): string | null {
  if (task.upstreamBlockers.length === 0) {
    return null
  }
  const titles = task.upstreamBlockers.map((ref) => ref.title).join(', ')
  return `Upstream cause: ${titles}`
}

type SegmentRow = Pick<HorizonTaskRowResponse, 'segments'>

export function segmentOn(
  task: SegmentRow,
  date: string,
): HorizonSegmentResponse | undefined {
  return task.segments.find((segment) => segment.date === date)
}

export function dayTotalMinutes(tasks: SegmentRow[], date: string): number {
  return tasks.reduce(
    (sum, task) => sum + (segmentOn(task, date)?.minutes ?? 0),
    0,
  )
}

/**
 * Shortfall is the saved day's out-of-time minutes only, the same figure Today's Shortfall shows.
 * Blocked and unestimated work stay visible in their cells but are not counted here.
 */
export function savedShortfallMinutes(tasks: SegmentRow[], date: string): number {
  return tasks.reduce((sum, task) => {
    const segment = segmentOn(task, date)
    return segment?.unplacedScope === 'SAVED_SHORTFALL' &&
      segment.unplacedReason === 'OUT_OF_TIME'
      ? sum + (segment.unplacedMinutes ?? 0)
      : sum
  }, 0)
}

export function deadlineBadgeLabel(
  deadlineStatus: HorizonTaskRowResponse['deadlineStatus'],
  unresolvedEffort: HorizonTaskRowResponse['unresolvedEffort'],
): string | null {
  switch (deadlineStatus) {
    case 'AT_RISK':
      return 'At risk'
    case 'ON_TRACK':
      return 'On track'
    case 'OVERDUE':
      return 'Overdue'
    case 'BEYOND_HORIZON':
      return 'Beyond horizon'
    case 'CANNOT_FORECAST': {
      if (unresolvedEffort.length === 0) {
        return "Can't forecast"
      }
      const names = unresolvedEffort.map((ref) => ref.title).join(', ')
      return `Can't forecast: ${names}`
    }
    default:
      return null
  }
}
