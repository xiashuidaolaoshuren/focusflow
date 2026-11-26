import type {
  DailyPlanResponse,
  ScheduledBlockResponse,
  TaskSnapshotResponse,
  UnplacedWorkResponse,
} from '@/types/api'

export type SnapshotTitleInfo = {
  title: string
  dueDate: string | null
}

function addSnapshot(
  map: Map<number, SnapshotTitleInfo>,
  snapshot: TaskSnapshotResponse | null | undefined,
) {
  if (snapshot == null) {
    return
  }
  map.set(snapshot.sourceTaskId, {
    title: snapshot.title,
    dueDate: snapshot.dueDate,
  })
}

function addWorkBlocks(
  map: Map<number, SnapshotTitleInfo>,
  blocks: ScheduledBlockResponse[],
) {
  for (const block of blocks) {
    if (block.kind === 'WORK') {
      addSnapshot(map, block.taskSnapshot)
    }
  }
}

function addUnplacedWork(
  map: Map<number, SnapshotTitleInfo>,
  entries: UnplacedWorkResponse[],
) {
  for (const entry of entries) {
    addSnapshot(map, entry.taskSnapshot)
  }
}

export function indexSnapshotTitles(
  plan: DailyPlanResponse,
): Map<number, SnapshotTitleInfo> {
  const map = new Map<number, SnapshotTitleInfo>()

  addWorkBlocks(map, plan.blocks)
  addWorkBlocks(map, plan.composedRail)
  addUnplacedWork(map, plan.unplacedWork)
  for (const revision of plan.revisions) {
    addWorkBlocks(map, revision.blocks)
    addUnplacedWork(map, revision.unplacedWork)
  }

  return map
}

/**
 * Titles for the view on screen: a chosen revision's own blocks and unplaced
 * snapshots, or the current day's sources. No other revision can supply a title.
 */
export function indexRevisionSnapshotTitles(
  plan: DailyPlanResponse,
  selectedRevisionId: number | null,
): Map<number, SnapshotTitleInfo> {
  const map = new Map<number, SnapshotTitleInfo>()
  const revision =
    selectedRevisionId == null
      ? null
      : (plan.revisions.find((item) => item.id === selectedRevisionId) ?? null)

  if (revision != null) {
    addWorkBlocks(map, revision.blocks)
    addUnplacedWork(map, revision.unplacedWork)
    return map
  }

  // The composed rail can carry historical blocks; the latest revision must win.
  addWorkBlocks(map, plan.composedRail)
  addWorkBlocks(map, plan.blocks)
  addUnplacedWork(map, plan.unplacedWork)
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
