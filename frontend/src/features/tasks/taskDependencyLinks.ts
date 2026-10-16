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

type RankingGroup = 'MUST_CONTINUE' | 'DUE_OR_OVERDUE' | 'OPTIONAL'

const GROUP_URGENCY: Record<RankingGroup, number> = {
  MUST_CONTINUE: 0,
  DUE_OR_OVERDUE: 1,
  OPTIONAL: 2,
}

function ownGroup(task: TaskResponse, planningDate: string): RankingGroup {
  if (task.status === 'IN_PROGRESS') {
    return 'MUST_CONTINUE'
  }
  if (task.status === 'OPEN' && task.dueDate != null && task.dueDate <= planningDate) {
    return 'DUE_OR_OVERDUE'
  }
  return 'OPTIONAL'
}

function compareDueThenId(left: TaskResponse, right: TaskResponse): number {
  if (left.dueDate !== right.dueDate) {
    if (left.dueDate == null) {
      return 1
    }
    if (right.dueDate == null) {
      return -1
    }
    return left.dueDate < right.dueDate ? -1 : 1
  }
  return left.id - right.id
}

/**
 * The live-link "Needed for" explanation for one task, or null when the task already holds its
 * inherited ranking group. Urgency travels only through Open and In-progress tasks.
 */
export function liveNeededForLabel(
  task: TaskResponse,
  tasksById: Map<number, TaskResponse>,
  planningDate: string,
): string | null {
  if (!isActiveDependencyStatus(task.status)) {
    return null
  }

  const own = ownGroup(task, planningDate)
  const chain: TaskResponse[] = [task]
  const seen = new Set<number>([task.id])
  for (let index = 0; index < chain.length; index++) {
    for (const link of chain[index].blocks) {
      if (!isActiveDependencyStatus(link.status) || seen.has(link.taskId)) {
        continue
      }
      const member = tasksById.get(link.taskId)
      if (member == null) {
        continue
      }
      seen.add(member.id)
      chain.push(member)
    }
  }

  let inherited = own
  for (const member of chain) {
    const group = ownGroup(member, planningDate)
    if (GROUP_URGENCY[group] < GROUP_URGENCY[inherited]) {
      inherited = group
    }
  }
  if (inherited === 'OPTIONAL' || GROUP_URGENCY[inherited] >= GROUP_URGENCY[own]) {
    return null
  }

  const named = chain
    .filter((member) => ownGroup(member, planningDate) === inherited)
    .sort(compareDueThenId)[0]
  if (named == null) {
    return null
  }
  const dueSuffix = named.dueDate != null ? ` (due ${named.dueDate})` : ''
  return `Needed for ${named.title}${dueSuffix}`
}
