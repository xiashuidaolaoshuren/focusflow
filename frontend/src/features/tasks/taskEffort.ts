import type { TaskResponse } from '@/types/api'

export function hasVisibleProgress(task: TaskResponse): boolean {
  if (task.status !== 'OPEN') {
    return true
  }
  if (task.remainingEffortMinutes == null || task.estimatedMinutes == null) {
    return task.remainingEffortMinutes !== task.estimatedMinutes
  }
  return task.remainingEffortMinutes !== task.estimatedMinutes
}

export const ESTIMATE_LOCK_COPY =
  'Editing the estimate does not change remaining effort. Use reassess remaining effort to update the remainder.'

/**
 * A Task that already has recorded work keeps its Open option closed; only an explicit reopen from
 * Done or Cancelled may return it to Open. The server enforces the same rule.
 */
export function canReturnToOpen(task: TaskResponse): boolean {
  return task.status !== 'IN_PROGRESS' || task.effortVersion === 0
}
