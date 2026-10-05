import { apiRequest } from '@/lib/api'
import { parseScheduledBlock } from '@/features/plans/blocks'
import type {
  BlockProgressRequest,
  BlockProgressResponse,
  DailyPlanResponse,
  DailyPlanSummaryResponse,
  GeneratePlanRequest,
  PageResponse,
  ReplanRequest,
  UnplannedWorkRequest,
  UnplannedWorkResponse,
} from '@/types/api'

function parsePlan(plan: DailyPlanResponse): DailyPlanResponse {
  return {
    ...plan,
    blocks: plan.blocks.map(parseScheduledBlock),
    composedRail: plan.composedRail.map(parseScheduledBlock),
    offRailEarlyCompletions: plan.offRailEarlyCompletions.map(parseScheduledBlock),
    revisions: plan.revisions.map((revision) => ({
      ...revision,
      blocks: revision.blocks.map(parseScheduledBlock),
    })),
  }
}

export async function listPlans(
  page: number,
  size: number,
): Promise<PageResponse<DailyPlanSummaryResponse>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  })
  return apiRequest<PageResponse<DailyPlanSummaryResponse>>(
    `/api/daily-plans?${params}`,
  )
}

export async function getPlanById(id: number): Promise<DailyPlanResponse> {
  return parsePlan(await apiRequest<DailyPlanResponse>(`/api/daily-plans/${id}`))
}

export async function getPlanByDate(
  planDate: string,
): Promise<DailyPlanResponse | null> {
  const plan = await apiRequest<DailyPlanResponse | undefined>(
    `/api/daily-plans/by-date?planDate=${encodeURIComponent(planDate)}`,
  )
  return plan == null ? null : parsePlan(plan)
}

export async function generateDailyPlan(
  request: GeneratePlanRequest,
): Promise<DailyPlanResponse> {
  return parsePlan(
    await apiRequest<DailyPlanResponse>('/api/daily-plans/generate', {
      method: 'POST',
      body: request,
    }),
  )
}

export async function recordBlockProgress(
  planId: number,
  blockId: number,
  request: BlockProgressRequest,
): Promise<BlockProgressResponse> {
  const response = await apiRequest<BlockProgressResponse>(
    `/api/daily-plans/${planId}/blocks/${blockId}/progress`,
    {
      method: 'PUT',
      body: request,
    },
  )
  return { ...response, plan: parsePlan(response.plan) }
}

export async function replanDailyPlan(
  id: number,
  request: ReplanRequest,
): Promise<DailyPlanResponse> {
  return parsePlan(
    await apiRequest<DailyPlanResponse>(`/api/daily-plans/${id}/replan`, {
      method: 'POST',
      body: request,
    }),
  )
}

export async function createUnplannedWork(
  request: UnplannedWorkRequest,
): Promise<UnplannedWorkResponse> {
  return apiRequest<UnplannedWorkResponse>('/api/unplanned-work', {
    method: 'POST',
    body: request,
  })
}

export async function deleteUnplannedWork(
  id: number,
  effortVersion: number | null,
): Promise<void> {
  const query =
    effortVersion != null ? `?effortVersion=${effortVersion}` : ''
  return apiRequest<void>(`/api/unplanned-work/${id}${query}`, {
    method: 'DELETE',
  })
}

export async function deletePlan(id: number): Promise<void> {
  return apiRequest<void>(`/api/daily-plans/${id}`, {
    method: 'DELETE',
  })
}
