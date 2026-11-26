import type {
  DailyPlanResponse,
  ScheduledBlockResponse,
  UnplacedWorkResponse,
} from '@/types/api'

/**
 * The blocks to show for a saved plan: the composed day when no revision is
 * chosen, the chosen revision's blocks otherwise. An unknown id falls back to
 * the composed day.
 */
export function revisionBlocks(
  plan: Pick<DailyPlanResponse, 'composedRail' | 'revisions'>,
  selectedRevisionId: number | null,
): ScheduledBlockResponse[] {
  if (selectedRevisionId == null) {
    return plan.composedRail
  }
  return (
    plan.revisions.find((revision) => revision.id === selectedRevisionId)
      ?.blocks ?? plan.composedRail
  )
}

/** The unplaced work to show: revision-specific for a chosen revision, latest otherwise. */
export function revisionUnplacedWork(
  plan: Pick<DailyPlanResponse, 'unplacedWork' | 'revisions'>,
  selectedRevisionId: number | null,
): UnplacedWorkResponse[] {
  if (selectedRevisionId == null) {
    return plan.unplacedWork
  }
  return (
    plan.revisions.find((revision) => revision.id === selectedRevisionId)
      ?.unplacedWork ?? plan.unplacedWork
  )
}
