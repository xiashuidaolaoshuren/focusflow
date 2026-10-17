import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createCommitment,
  deleteCommitment,
  listCommitments,
  updateCommitment,
} from '@/features/commitments/api'
import { horizonQueryPrefix } from '@/features/horizon/hooks'
import { markRegeneratePromptNeeded } from '@/features/plans/regeneratePrompt'
import type { CommitmentRequest } from '@/types/api'

export const commitmentsQueryPrefix = ['commitments'] as const

export function commitmentsQueryKey(planDate: string) {
  return [...commitmentsQueryPrefix, planDate] as const
}

export function useCommitments(planDate: string) {
  const query = useQuery({
    queryKey: commitmentsQueryKey(planDate),
    queryFn: () => listCommitments(planDate, planDate),
  })

  return {
    ...query,
    commitments: query.data ?? [],
  }
}

export function useCreateCommitment(planDate: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: CommitmentRequest) => createCommitment(request),
    onSuccess: async (commitment) => {
      markRegeneratePromptNeeded()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: commitmentsQueryKey(planDate),
        }),
        queryClient.invalidateQueries({
          queryKey: commitmentsQueryKey(commitment.commitmentDate),
        }),
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
      ])
    },
  })
}

export function useUpdateCommitment(planDate: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      request,
    }: {
      id: number
      request: CommitmentRequest
    }) => updateCommitment(id, request),
    onSuccess: async (commitment) => {
      markRegeneratePromptNeeded()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: commitmentsQueryKey(planDate),
        }),
        queryClient.invalidateQueries({
          queryKey: commitmentsQueryKey(commitment.commitmentDate),
        }),
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
      ])
    },
  })
}

export function useDeleteCommitment(planDate: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteCommitment(id),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: commitmentsQueryKey(planDate),
        }),
        queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
      ])
    },
  })
}
