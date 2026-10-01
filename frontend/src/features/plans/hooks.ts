import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  clearRegeneratePrompt,
} from '@/features/plans/regeneratePrompt'
import {
  deletePlan,
  generateDailyPlan,
  getPlanByDate,
  getPlanById,
  listPlans,
} from '@/features/plans/api'
import type { GeneratePlanRequest } from '@/types/api'

export const plansByDateQueryPrefix = ['plans', 'by-date'] as const
export const plansListQueryPrefix = ['plans', 'list'] as const

export function planByDateQueryKey(planDate: string) {
  return [...plansByDateQueryPrefix, planDate] as const
}

export function plansQueryKey(page: number, size: number) {
  return [...plansListQueryPrefix, page, size] as const
}

export function planDetailQueryKey(id: number) {
  return ['plans', 'detail', id] as const
}

function isValidPlanId(id: number): boolean {
  return Number.isInteger(id) && id > 0
}

export function usePlanByDate(planDate: string) {
  const query = useQuery({
    queryKey: planByDateQueryKey(planDate),
    queryFn: () => getPlanByDate(planDate),
  })

  return {
    ...query,
    plan: query.data ?? null,
    hasPlan: query.data != null,
  }
}

export function usePlans(page: number, size: number) {
  const query = useQuery({
    queryKey: plansQueryKey(page, size),
    queryFn: () => listPlans(page, size),
  })

  return {
    ...query,
    plans: query.data?.content ?? [],
    page: query.data ?? null,
    isEmpty: !query.isPending && (query.data?.content.length ?? 0) === 0,
  }
}

export function usePlan(id: number) {
  const query = useQuery({
    queryKey: planDetailQueryKey(id),
    queryFn: () => getPlanById(id),
    enabled: isValidPlanId(id),
  })

  return {
    ...query,
    plan: query.data ?? null,
  }
}

export function useGeneratePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: GeneratePlanRequest) => generateDailyPlan(request),
    onSuccess: async (plan) => {
      clearRegeneratePrompt()
      queryClient.setQueryData(planByDateQueryKey(plan.planDate), plan)
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: planByDateQueryKey(plan.planDate),
        }),
        queryClient.invalidateQueries({ queryKey: plansListQueryPrefix }),
      ])
    },
  })
}

export function useDeletePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deletePlan(id),
    onSuccess: async (_data, id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: plansByDateQueryPrefix }),
        queryClient.invalidateQueries({ queryKey: plansListQueryPrefix }),
        queryClient.invalidateQueries({ queryKey: planDetailQueryKey(id) }),
      ])
    },
  })
}
