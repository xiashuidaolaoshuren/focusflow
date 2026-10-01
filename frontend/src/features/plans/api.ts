import { apiRequest } from '@/lib/api'
import { parseScheduledBlock } from '@/features/plans/blocks'
import type {
  DailyPlanResponse,
  DailyPlanSummaryResponse,
  GeneratePlanRequest,
  PageResponse,
} from '@/types/api'

function parsePlan(plan: DailyPlanResponse): DailyPlanResponse {
  return { ...plan, blocks: plan.blocks.map(parseScheduledBlock) }
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

export async function deletePlan(id: number): Promise<void> {
  return apiRequest<void>(`/api/daily-plans/${id}`, {
    method: 'DELETE',
  })
}
