import { ApiError } from '@/lib/api'

const OVERLAP_REJECTION = 'commitments must not overlap on the same date'

/** The message to show for a failed commitment save, in the app's plain English. */
export function commitmentErrorMessage(error: unknown): string | undefined {
  if (!(error instanceof Error)) {
    return undefined
  }
  if (error instanceof ApiError && error.message === OVERLAP_REJECTION) {
    return 'That time overlaps another commitment.'
  }
  return error.message
}

type WorkWindow = { workDayStart: string; workDayEnd: string }

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

function clock(time: string): string {
  return time.slice(0, 5)
}

/** Refuses a commitment that starts or ends outside the saved Work window; null when it fits. */
export function outsideWorkWindowMessage(
  startTime: string,
  endTime: string,
  window: WorkWindow,
): string | null {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if (start >= toMinutes(window.workDayStart) && end <= toMinutes(window.workDayEnd)) {
    return null
  }
  return `Keep it inside the Work window (${clock(window.workDayStart)}–${clock(window.workDayEnd)}).`
}


