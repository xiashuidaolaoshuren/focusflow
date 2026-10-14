import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { horizonQueryPrefix } from '@/features/horizon/hooks'
import {
  getSchedulingPreferences,
  updateSchedulingPreferences,
} from '@/features/preferences/api'
import { markRegeneratePromptNeeded } from '@/features/plans/regeneratePrompt'
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
      markRegeneratePromptNeeded()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: schedulingPreferencesQueryKey,
        }),
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
      ])
      toast.success('Scheduling preferences saved')
    },
  })
}
