import type { DailyPlanResponse, ScheduledBlockResponse } from '@/types/api'

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
