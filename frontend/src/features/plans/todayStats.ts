import { planHealth } from '@/features/plans/planHealthModel'
import { creditFor, plannedMinutes } from '@/features/plans/progressRules'
import { toMinutes } from '@/features/plans/railModel'
import type { DailyPlanResponse, WorkBlockResponse } from '@/types/api'

export type TodayStats = {
  planned: number
  done: number
  left: number
  shortfall: number
}

function countedBlocks(plan: DailyPlanResponse): WorkBlockResponse[] {
  return plan.composedRail.filter(
    (block): block is WorkBlockResponse =>
      block.kind === 'WORK' && block.displayState !== 'NO_LONGER_NEEDED',
  )
}

function leftMinutes(
  block: WorkBlockResponse,
  planDate: string,
  today: string,
  nowMinutes: number,
): number {
  if (planDate > today) {
    return plannedMinutes(block)
  }
  if (planDate < today) {
    return 0
  }
  return Math.max(
    0,
    toMinutes(block.endTime) - Math.max(toMinutes(block.startTime), nowMinutes),
  )
}

/**
 * The four figures on Today: the planned focus on the rail, the credit recorded outcomes earn,
 * the work still ahead on today's remaining sessions, and what did not fit.
 */
export function todayStats(
  plan: DailyPlanResponse | null,
  planDate: string,
  today: string,
  nowMinutes: number,
): TodayStats | null {
  if (plan == null) {
    return null
  }

  let planned = 0
  let done = 0
  let left = 0

  for (const block of countedBlocks(plan)) {
    const minutes = plannedMinutes(block)
    planned += minutes
    if (block.outcome != null) {
      done += creditFor(block.outcome, minutes, block.actualMinutes)
    } else {
      left += leftMinutes(block, planDate, today, nowMinutes)
    }
  }

  return {
    planned,
    done,
    left,
    shortfall: planHealth(plan).shortfall?.minutes ?? 0,
  }
}
