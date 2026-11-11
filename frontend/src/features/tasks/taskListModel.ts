import { isActiveDependencyStatus } from '@/features/tasks/taskDependencyLinks'
import type { TaskResponse } from '@/types/api'

export type TaskTab = 'active' | 'done' | 'cancelled' | 'all'

export type TaskTabCounts = Record<TaskTab, number>

function inTab(task: TaskResponse, tab: TaskTab): boolean {
  switch (tab) {
    case 'active':
      return isActiveDependencyStatus(task.status)
    case 'done':
      return task.status === 'DONE'
    case 'cancelled':
      return task.status === 'CANCELLED'
    case 'all':
      return true
  }
}

/** The rows a tab shows. Active is Open plus In progress. */
export function filterTasks(tasks: TaskResponse[], tab: TaskTab): TaskResponse[] {
  return tasks.filter((task) => inTab(task, tab))
}

/** How many tasks each tab holds. */
export function tabCounts(tasks: TaskResponse[]): TaskTabCounts {
  return {
    active: filterTasks(tasks, 'active').length,
    done: filterTasks(tasks, 'done').length,
    cancelled: filterTasks(tasks, 'cancelled').length,
    all: tasks.length,
  }
}

/** Tasks whose title contains the query. Descriptions are not searched. */
export function searchTasks(
  tasks: TaskResponse[],
  query: string,
): TaskResponse[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return tasks
  }
  return tasks.filter((task) => task.title.toLowerCase().includes(needle))
}

export type TaskSort = 'due' | 'priority' | 'effort'

const PRIORITY_RANK: Record<TaskResponse['priority'], number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
}

function byDue(left: TaskResponse, right: TaskResponse): number {
  if (left.dueDate === right.dueDate) {
    return 0
  }
  if (left.dueDate == null) {
    return 1
  }
  if (right.dueDate == null) {
    return -1
  }
  return left.dueDate < right.dueDate ? -1 : 1
}

function byPriority(left: TaskResponse, right: TaskResponse): number {
  return PRIORITY_RANK[left.priority] - PRIORITY_RANK[right.priority]
}

function byEffort(left: TaskResponse, right: TaskResponse): number {
  const l = left.remainingEffortMinutes
  const r = right.remainingEffortMinutes
  if (l === r) {
    return 0
  }
  if (l == null) {
    return 1
  }
  if (r == null) {
    return -1
  }
  return r - l
}

const COMPARATORS: Record<TaskSort, (left: TaskResponse, right: TaskResponse) => number> = {
  due: byDue,
  priority: byPriority,
  effort: byEffort,
}

/** Sort a copy of the list; ties fall back to title, then id, so the order is stable. */
export function sortTasks(tasks: TaskResponse[], sort: TaskSort): TaskResponse[] {
  const compare = COMPARATORS[sort]
  return [...tasks].sort(
    (left, right) =>
      compare(left, right) ||
      left.title.localeCompare(right.title) ||
      left.id - right.id,
  )
}
