import { wouldExhaustRemainder } from '@/features/plans/progressRules'
import type { UnplannedWorkRequest } from '@/types/api'

/** What the Log unplanned work dialog holds before it is sent. Minutes stay as typed text. */
export type UnplannedWorkDraft = {
  taskId: number | null
  taskRemainingMinutes: number | null
  effortVersion: number
  workDate: string
  actualMinutes: string
  finish: boolean
  reassess: boolean
  checkpointMinutes: string
  today: string
}

function parsePositive(text: string): number | null {
  const parsed = Number.parseInt(text.trim(), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** A checkpoint is sent only for a reassessment with a positive value. */
function checkpointFor(draft: UnplannedWorkDraft): { remainingEffortMinutes: number } | null {
  if (!draft.reassess) {
    return null
  }
  const minutes = parsePositive(draft.checkpointMinutes)
  return minutes == null ? null : { remainingEffortMinutes: minutes }
}

/**
 * Entry rules: a task, positive minutes, a work date no later than today, and no save that would
 * use up a known remainder unless the user finishes the task or reassesses what is left.
 */
export function canSubmitUnplannedWork(draft: UnplannedWorkDraft): boolean {
  if (draft.taskId == null) {
    return false
  }
  const minutes = parsePositive(draft.actualMinutes)
  if (minutes == null || draft.workDate > draft.today) {
    return false
  }
  if (draft.finish || checkpointFor(draft) != null) {
    return true
  }
  return !wouldExhaustRemainder(draft.taskRemainingMinutes, minutes)
}

export function buildUnplannedWorkRequest(
  draft: UnplannedWorkDraft,
): UnplannedWorkRequest {
  return {
    taskId: draft.taskId!,
    workDate: draft.workDate,
    actualMinutes: parsePositive(draft.actualMinutes)!,
    currentDate: draft.today,
    effortVersion: draft.effortVersion,
    finish: draft.finish,
    checkpoint: draft.finish ? null : checkpointFor(draft),
  }
}
