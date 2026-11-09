import type { QueryClient } from '@tanstack/react-query'

import type { DailyPlanResponse } from '@/types/api'

export const currentUserQueryKey = ['auth', 'me'] as const

export const commitmentsQueryPrefix = ['commitments'] as const

export function commitmentsQueryKey(planDate: string) {
  return [...commitmentsQueryPrefix, planDate] as const
}

export const horizonQueryPrefix = ['horizon'] as const

export function horizonQueryKey(currentDate: string, currentTime: string) {
  return [...horizonQueryPrefix, currentDate, currentTime] as const
}

export const plansByDateQueryPrefix = ['plans', 'by-date'] as const
export const plansListQueryPrefix = ['plans', 'list'] as const
export const plansDetailQueryPrefix = ['plans', 'detail'] as const

export function planByDateQueryKey(planDate: string) {
  return [...plansByDateQueryPrefix, planDate] as const
}

export function plansQueryKey(page: number, size: number) {
  return [...plansListQueryPrefix, page, size] as const
}

export function planDetailQueryKey(id: number) {
  return [...plansDetailQueryPrefix, id] as const
}

export const schedulingPreferencesQueryKey = ['scheduling-preferences'] as const

export const tasksQueryKey = ['tasks', 'list'] as const

/** Refetches every view of a plan plus the task list that shares its effort state. */
export function invalidatePlanQueries(
  queryClient: QueryClient,
  plan: Pick<DailyPlanResponse, 'id' | 'planDate'>,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: planByDateQueryKey(plan.planDate) }),
    queryClient.invalidateQueries({ queryKey: plansListQueryPrefix }),
    queryClient.invalidateQueries({ queryKey: planDetailQueryKey(plan.id) }),
    queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
    queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
  ])
}
