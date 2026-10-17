import type { DailyPlanResponse, TaskSnapshotResponse } from '@/types/api'

export type SnapshotTitleInfo = {
  title: string
  dueDate: string | null
}

export function indexSnapshotTitles(
  plan: DailyPlanResponse,
): Map<number, SnapshotTitleInfo> {
  const map = new Map<number, SnapshotTitleInfo>()

  function add(snapshot: TaskSnapshotResponse | null | undefined) {
    if (snapshot == null) {
      return
    }
    map.set(snapshot.sourceTaskId, {
      title: snapshot.title,
      dueDate: snapshot.dueDate,
    })
  }

  for (const block of plan.blocks) {
    if (block.kind === 'WORK') {
      add(block.taskSnapshot)
    }
  }
  for (const block of plan.composedRail) {
    if (block.kind === 'WORK') {
      add(block.taskSnapshot)
    }
  }
  for (const entry of plan.unplacedWork) {
    add(entry.taskSnapshot)
  }
  for (const revision of plan.revisions) {
    for (const block of revision.blocks) {
      if (block.kind === 'WORK') {
        add(block.taskSnapshot)
      }
    }
    for (const entry of revision.unplacedWork) {
      add(entry.taskSnapshot)
    }
  }

  return map
}

export function blockerTitles(
  blockerSourceTaskIds: number[],
  titles: Map<number, SnapshotTitleInfo>,
): string[] {
  return blockerSourceTaskIds.map(
    (id) => titles.get(id)?.title ?? `Task ${id}`,
  )
}

export function formatWaitingOn(
  blockerSourceTaskIds: number[],
  titles: Map<number, SnapshotTitleInfo>,
): string {
  return blockerTitles(blockerSourceTaskIds, titles).join(', ')
}

export function formatNeededFor(
  snapshot: TaskSnapshotResponse,
  titles: Map<number, SnapshotTitleInfo>,
): string | null {
  if (snapshot.neededForTaskId == null) {
    return null
  }
  const target = titles.get(snapshot.neededForTaskId)
  if (target == null) {
    return null
  }
  const dueSuffix =
    target.dueDate != null ? ` (due ${target.dueDate})` : ''
  return `Needed for ${target.title}${dueSuffix}`
}
