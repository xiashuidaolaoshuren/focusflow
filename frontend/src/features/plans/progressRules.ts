import type { WorkBlockResponse, WorkOutcome } from '@/types/api'

/** The minimum a planned block needs to expose for the progress rules. */
export type PlannedBlock = Pick<WorkBlockResponse, 'startTime' | 'endTime'>

export function plannedMinutes(block: PlannedBlock): number {
  const [startHour, startMinute] = block.startTime.slice(0, 5).split(':').map(Number)
  const [endHour, endMinute] = block.endTime.slice(0, 5).split(':').map(Number)
  return (
    endHour! * 60 + endMinute! - (startHour! * 60 + startMinute!)
  )
}

/**
 * The provisional credit an outcome grants, mirroring `BlockProgressService.credit`: a done
 * session credits its planned duration, a partly done session credits its actual minutes, and a
 * skipped session credits nothing.
 */
export function creditFor(
  outcome: WorkOutcome,
  planned: number,
  actualMinutes: number | null,
): number {
  if (outcome === 'DONE') {
    return planned
  }
  if (outcome === 'PARTLY_DONE') {
    return actualMinutes ?? 0
  }
  return 0
}

/** A known remainder is exhausted when the credit leaves nothing over; an unknown one never is. */
export function wouldExhaustRemainder(
  remainingMinutes: number | null,
  credit: number,
): boolean {
  return remainingMinutes != null && remainingMinutes - credit <= 0
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours! * 60 + minutes!
}

/**
 * A session still running on the actionable revision: it started before the current clock time and
 * ends after it. Only such a block reconciles, because the server requires it to sit on the latest
 * revision and to straddle the cutoff the save carries.
 */
export function isCrossingNow(
  block: Pick<WorkBlockResponse, 'startTime' | 'endTime' | 'displayState'>,
  currentTime: string,
): boolean {
  if (block.displayState !== 'ACTIONABLE') {
    return false
  }
  const now = timeToMinutes(currentTime)
  return timeToMinutes(block.startTime) < now && now < timeToMinutes(block.endTime)
}
