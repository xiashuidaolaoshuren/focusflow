import { apiRequest } from '@/lib/api'
import type {
  SchedulingPreferencesRequest,
  SchedulingPreferencesResponse,
} from '@/types/api'

export async function getSchedulingPreferences(): Promise<SchedulingPreferencesResponse> {
  return apiRequest<SchedulingPreferencesResponse>('/api/scheduling-preferences')
}

export async function updateSchedulingPreferences(
  request: SchedulingPreferencesRequest,
): Promise<SchedulingPreferencesResponse> {
  return apiRequest<SchedulingPreferencesResponse>('/api/scheduling-preferences', {
    method: 'PUT',
    body: request,
  })
}
