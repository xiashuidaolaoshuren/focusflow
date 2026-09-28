import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  getSchedulingPreferences,
  updateSchedulingPreferences,
} from '@/features/preferences/api'
import type { SchedulingPreferencesRequest } from '@/types/api'

export const schedulingPreferencesQueryKey = [
  'scheduling-preferences',
] as const

export function useSchedulingPreferences() {
  const query = useQuery({
    queryKey: schedulingPreferencesQueryKey,
    queryFn: getSchedulingPreferences,
  })

  return {
    ...query,
    preferences: query.data ?? null,
  }
}

export function useUpdateSchedulingPreferences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: SchedulingPreferencesRequest) =>
      updateSchedulingPreferences(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: schedulingPreferencesQueryKey,
      })
      toast.success('Scheduling preferences saved')
    },
  })
}
