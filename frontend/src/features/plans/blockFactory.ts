import type { LabelledBlockKind, LabelledBlockResponse } from '@/types/api'

/** `HH:mm:00` for a minute-of-day. */
export function toBlockTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(minutes % 60).padStart(2, '0')
  return `${hours}:${mins}:00`
}

/** A non-work block carrying the fields every scheduled block has. */
export function labelledBlock(
  kind: LabelledBlockKind,
  startMinutes: number,
  endMinutes: number,
  label: string,
  id: number,
): LabelledBlockResponse {
  return {
    id,
    revisionId: 0,
    outcome: null,
    actualMinutes: null,
    reconciled: false,
    progressVersion: 0,
    displayState: 'ACTIONABLE',
    startTime: toBlockTime(startMinutes),
    endTime: toBlockTime(endMinutes),
    kind,
    sessionIndex: null,
    sessionCount: null,
    taskSnapshot: null,
    label,
  }
}
