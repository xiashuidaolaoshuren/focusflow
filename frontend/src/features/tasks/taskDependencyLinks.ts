import type { TaskLinkResponse, TaskResponse, TaskStatus } from '@/types/api'

export function isActiveDependencyStatus(status: TaskStatus): boolean {
  return status === 'OPEN' || status === 'IN_PROGRESS'
}

export function countActiveBlockedBy(task: TaskResponse): number {
  return task.blockedBy.filter(
    (link) =>
      isActiveDependencyStatus(task.status) &&
      isActiveDependencyStatus(link.status),
  ).length
}

export function countActiveBlocks(task: TaskResponse): number {
  return task.blocks.filter(
    (link) =>
      isActiveDependencyStatus(task.status) &&
      isActiveDependencyStatus(link.status),
  ).length
}

export function activeBlockedByLinks(task: TaskResponse): TaskLinkResponse[] {
  return task.blockedBy.filter((link) => isActiveDependencyStatus(link.status))
}
