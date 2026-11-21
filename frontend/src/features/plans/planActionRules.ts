import { latestRevisionId, planHasProgress } from '@/features/plans/planConflicts'
import { getLocalDateString, getLocalMinuteString } from '@/lib/planningDate'
import type { DailyPlanResponse, ReplanRequest, TaskResponse } from '@/types/api'

export type ActionVisibility = {
  generate: boolean
  regenerate: boolean
  replan: boolean
}

const NONE: ActionVisibility = {
  generate: false,
  regenerate: false,
  replan: false,
}

/**
 * Which plan action the header may offer. Generate replaces a missing plan, Regenerate only
 * while the plan has no recorded outcome, and Re-plan only for the client's current date.
 */
export function actionVisibility(
  plan: DailyPlanResponse | null,
  planDate: string,
  today: string,
): ActionVisibility {
  if (plan == null) {
    return { ...NONE, generate: true }
  }

  if (planDate < today) {
    return { ...NONE }
  }

  return {
    generate: false,
    regenerate: !planHasProgress(plan),
    replan: planDate === today,
  }
}

/** The request a re-plan sends: the latest revision plus the effort the client last saw. */
export function buildReplanRequest(
  plan: DailyPlanResponse,
  tasks: TaskResponse[],
  now: Date,
): ReplanRequest | null {
  const expectedRevisionId = latestRevisionId(plan)
  if (expectedRevisionId == null) {
    return null
  }

  return {
    currentDate: getLocalDateString(now),
    cutoff: getLocalMinuteString(now),
    expectedRevisionId,
    effortVersions: tasks
      .filter((task) => task.status === 'OPEN' || task.status === 'IN_PROGRESS')
      .map((task) => ({ taskId: task.id, effortVersion: task.effortVersion })),
  }
}
