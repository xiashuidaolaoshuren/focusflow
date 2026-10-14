import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'

import {
  clearRegeneratePrompt,
} from '@/features/plans/regeneratePrompt'
import {
  createUnplannedWork,
  deletePlan,
  deleteUnplannedWork,
  generateDailyPlan,
  getPlanByDate,
  getPlanById,
  listPlans,
  recordBlockProgress,
  replanDailyPlan,
} from '@/features/plans/api'
import { horizonQueryPrefix } from '@/features/horizon/hooks'
import { isPlanRefetchConflict } from '@/features/plans/planConflicts'
import { tasksQueryKey } from '@/features/tasks/hooks'
import type {
  BlockProgressRequest,
  DailyPlanResponse,
  GeneratePlanRequest,
  ReplanRequest,
  UnplannedWorkRequest,
} from '@/types/api'

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

/**
 * A conflicting write cannot name the plan it lost, so every plan view refetches and the newer
 * server state replaces what the client had.
 */
function refetchPlanViews(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: plansByDateQueryPrefix }),
    queryClient.invalidateQueries({ queryKey: plansListQueryPrefix }),
    queryClient.invalidateQueries({ queryKey: plansDetailQueryPrefix }),
    queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
    queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
  ])
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
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
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
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
      ])
    },
  })
}

type UseRecordBlockProgressOptions = {
  onConflict?: () => void
}

export function useRecordBlockProgress(
  options?: UseRecordBlockProgressOptions,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      planId,
      blockId,
      request,
    }: {
      planId: number
      blockId: number
      request: BlockProgressRequest
    }) => recordBlockProgress(planId, blockId, request),
    onSuccess: async (response) => {
      await invalidatePlanQueries(queryClient, response.plan)
    },
    onError: async (error) => {
      if (isPlanRefetchConflict(error)) {
        await refetchPlanViews(queryClient)
        options?.onConflict?.()
      }
    },
  })
}

export function useCreateUnplannedWork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: UnplannedWorkRequest) =>
      createUnplannedWork(request),
    onSuccess: async () => {
      await refetchPlanViews(queryClient)
    },
  })
}

export function useReplan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: number
      request: ReplanRequest
    }) => replanDailyPlan(id, request),
    onSuccess: async (plan) => {
      await invalidatePlanQueries(queryClient, plan)
    },
    onError: async (error) => {
      if (isPlanRefetchConflict(error)) {
        await refetchPlanViews(queryClient)
      }
    },
  })
}

export function useDeleteUnplannedWork() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      effortVersion,
    }: {
      id: number
      effortVersion: number | null
    }) => deleteUnplannedWork(id, effortVersion),
    onSuccess: async () => {
      await refetchPlanViews(queryClient)
    },
  })
}
