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
