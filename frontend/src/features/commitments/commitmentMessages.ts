import { ApiError } from '@/lib/api'
import { toClockMinutes } from '@/lib/planningDate'

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

function clock(time: string): string {
  return time.slice(0, 5)
}

/** Refuses a commitment that starts or ends outside the saved Work window; null when it fits. */
export function outsideWorkWindowMessage(
  startTime: string,
  endTime: string,
  window: WorkWindow,
): string | null {
  const start = toClockMinutes(startTime)
  const end = toClockMinutes(endTime)
  if (start >= toClockMinutes(window.workDayStart) && end <= toClockMinutes(window.workDayEnd)) {
    return null
  }
  return `Keep it inside the Work window (${clock(window.workDayStart)}–${clock(window.workDayEnd)}).`
}


