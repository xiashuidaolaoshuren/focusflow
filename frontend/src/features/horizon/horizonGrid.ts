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
  const [hours, minutes] = time.split(':').map(Number)
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

export function formatDueDateTitle(dueDate: string | null): string {
  return dueDate ?? 'No due date'
}

const EXCLUSION_LABELS = {
  DEPENDENCY: 'dependency',
  CHECKPOINT: 'checkpoint',
} as const

export function segmentCellCopy(segment: HorizonSegmentResponse): string[] {
  const lines: string[] = []

  if (segment.minutes > 0 && segment.unplacedReason == null) {
    lines.push(`${segment.minutes} min`)
  }

  if (segment.unplacedReason != null) {
    lines.push(UNPLACED_REASON_LABELS[segment.unplacedReason])
  }

  if (
    segment.unplacedScope === 'SAVED_SHORTFALL' &&
    segment.unplacedMinutes != null
  ) {
    lines.push(`Saved shortfall: ${segment.unplacedMinutes} min`)
  } else if (
    segment.unplacedScope === 'FORECAST' &&
    segment.unplacedMinutes != null &&
    segment.unplacedReason === 'OUT_OF_TIME'
  ) {
    lines.push(`${segment.unplacedMinutes} min unplaced`)
  }

  if (
    segment.assumedCreditMinutes != null &&
    segment.assumedCreditMinutes !== segment.minutes
  ) {
    const causes = segment.creditExclusions
      .map((exclusion) => EXCLUSION_LABELS[exclusion])
      .join(', ')
    const creditLine = `${segment.assumedCreditMinutes} min credited of ${segment.minutes} min displayed`
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

export function dashboardHref(date: string): string {
  return `/dashboard?date=${date}`
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

export function deadlineBadgeLabel(
  deadlineStatus: HorizonTaskRowResponse['deadlineStatus'],
  unresolvedEffort: HorizonTaskRowResponse['unresolvedEffort'],
): string | null {
  switch (deadlineStatus) {
    case 'AT_RISK':
      return 'At risk'
    case 'OVERDUE':
      return 'Overdue'
    case 'CANNOT_FORECAST': {
      if (unresolvedEffort.length === 0) {
        return 'Cannot forecast'
      }
      const names = unresolvedEffort.map((ref) => ref.title).join(', ')
      return `Cannot forecast: ${names}`
    }
    default:
      return null
  }
}
