import { activeBlockedByLinks } from '@/features/tasks/taskDependencyLinks'
import { filterTasks } from '@/features/tasks/taskListModel'
import type { TaskResponse } from '@/types/api'

export type MiniTaskRow = {
  task: TaskResponse
  /** No estimate and nothing blocking it: the planner has nothing to place. */
  unplaced: boolean
}

const PRIORITY_RANK: Record<TaskResponse['priority'], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

function byDueThenPriority(left: TaskResponse, right: TaskResponse): number {
  if (left.dueDate !== right.dueDate) {
    if (left.dueDate == null) {
      return 1
    }
    if (right.dueDate == null) {
      return -1
    }
    return left.dueDate < right.dueDate ? -1 : 1
  }
  return (
    PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority] ||
    left.title.localeCompare(right.title) ||
    left.id - right.id
  )
}

/** The compact Tasks card: active work by due date, then priority, with undated tasks last. */
export function miniTaskRows(tasks: TaskResponse[]): MiniTaskRow[] {
  return filterTasks(tasks, 'active')
    .sort(byDueThenPriority)
    .map((task) => ({
      task,
      unplaced:
        task.remainingEffortMinutes == null &&
        activeBlockedByLinks(task).length === 0,
    }))
}
