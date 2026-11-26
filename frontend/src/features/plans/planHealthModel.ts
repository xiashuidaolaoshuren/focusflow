import { plannedMinutes } from '@/features/plans/progressRules'
import type { DailyPlanResponse, ScheduledBlockResponse } from '@/types/api'

export type ShortfallRow = {
  title: string
  placed: number
  total: number
}

export type PlanHealthView = {
  shortfall: { minutes: number; rows: ShortfallRow[] } | null
  blocked: { title: string; waitingOn: number[] }[]
  unplaced: { title: string }[]
}

function placedMinutesFor(
  rail: ScheduledBlockResponse[],
  sourceTaskId: number,
): number {
  return rail.reduce((total, block) => {
    if (block.kind !== 'WORK' || block.taskSnapshot.sourceTaskId !== sourceTaskId) {
      return total
    }
    return total + plannedMinutes(block)
  }, 0)
}

/**
 * Plan health reads the plan's own unplaced work: what did not fit today (Shortfall), what is
 * waiting on another task (Blocked), and what has no estimate (Unplaced).
 */
export function planHealth(plan: DailyPlanResponse): PlanHealthView {
  const outOfTime = plan.unplacedWork.filter((entry) => entry.reason === 'OUT_OF_TIME')

  const rows = outOfTime.map((entry) => {
    const placed = placedMinutesFor(
      plan.composedRail,
      entry.taskSnapshot.sourceTaskId,
    )
    return {
      title: entry.taskSnapshot.title,
      placed,
      total: placed + (entry.unplacedMinutes ?? 0),
    }
  })

  return {
    shortfall:
      rows.length > 0
        ? {
            minutes: outOfTime.reduce(
              (total, entry) => total + (entry.unplacedMinutes ?? 0),
              0,
            ),
            rows,
          }
        : null,
    blocked: plan.unplacedWork
      .filter((entry) => entry.reason === 'BLOCKED')
      .map((entry) => ({
        title: entry.taskSnapshot.title,
        waitingOn: entry.blockerSourceTaskIds,
      })),
    unplaced: plan.unplacedWork
      .filter((entry) => entry.reason === 'NO_ESTIMATE')
      .map((entry) => ({ title: entry.taskSnapshot.title })),
  }
}
