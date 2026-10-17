import { apiRequest } from '@/lib/api'
import type { HorizonResponse } from '@/types/api'

export async function getHorizon(
  currentDate: string,
  currentTime: string,
): Promise<HorizonResponse> {
  const params = new URLSearchParams({
    currentDate,
    currentTime,
  })
  return apiRequest<HorizonResponse>(`/api/horizon?${params}`)
}
