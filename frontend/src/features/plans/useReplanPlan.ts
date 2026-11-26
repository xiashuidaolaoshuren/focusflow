import { buildReplanRequest } from '@/features/plans/planActionRules'
import { useReplan } from '@/features/plans/hooks'
import { useTasks } from '@/features/tasks/hooks'
import type { DailyPlanResponse } from '@/types/api'

/** One owner for the Re-plan mutation, shared by the header action and the Needs refresh alert. */
export type ReplanControl = {
  run: () => void
  isPending: boolean
  error: unknown
}

export function useReplanPlan(
  plan: DailyPlanResponse | null,
  now: Date = new Date(),
): ReplanControl {
  const { mutate, isPending, error } = useReplan()
  const { tasks } = useTasks()

  function run() {
    if (plan == null) {
      return
    }
    const request = buildReplanRequest(plan, tasks, now)
    if (request == null) {
      return
    }
    mutate({ id: plan.id, request })
  }

  return { run, isPending, error }
}
