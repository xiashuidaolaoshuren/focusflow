import { apiRequest } from '@/lib/api'
import type {
  DailyPlanResponse,
  DailyPlanSummaryResponse,
  GeneratePlanRequest,
  PageResponse,
} from '@/types/api'

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
  return apiRequest<DailyPlanResponse>(`/api/daily-plans/${id}`)
}

export async function getPlanByDate(
  planDate: string,
): Promise<DailyPlanResponse | null> {
  const plan = await apiRequest<DailyPlanResponse | undefined>(
    `/api/daily-plans/by-date?planDate=${encodeURIComponent(planDate)}`,
  )
  return plan ?? null
}

export async function generateDailyPlan(
  request: GeneratePlanRequest,
): Promise<DailyPlanResponse> {
  return apiRequest<DailyPlanResponse>('/api/daily-plans/generate', {
    method: 'POST',
    body: request,
  })
}

export async function deletePlan(id: number): Promise<void> {
  return apiRequest<void>(`/api/daily-plans/${id}`, {
    method: 'DELETE',
  })
}
