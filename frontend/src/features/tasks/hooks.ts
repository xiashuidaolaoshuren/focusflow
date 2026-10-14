import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { horizonQueryPrefix } from '@/features/horizon/hooks'
import { markRegeneratePromptNeeded } from '@/features/plans/regeneratePrompt'
import {
  addBlocker,
  createTask,
  deleteTask,
  listTasks,
  reassessRemainingEffort,
  removeBlocker,
  updateTask,
} from '@/features/tasks/api'
import { isProgressConflict } from '@/features/tasks/taskEffortConflict'
import type {
  CreateTaskRequest,
  RemainingEffortRequest,
  UpdateTaskRequest,
} from '@/types/api'

export const tasksQueryKey = ['tasks', 'list'] as const
export const createTaskMutationKey = ['tasks', 'create'] as const
export const updateTaskMutationKey = ['tasks', 'update'] as const
export const formUpdateTaskMutationKey = ['tasks', 'form-update'] as const
export const reassessRemainingEffortMutationKey = [
  'tasks',
  'reassess-remaining-effort',
] as const

export type UseUpdateTaskOptions = {
  mutationKey?: readonly string[]
  onEffortConflict?: () => void
}

export type UseReassessRemainingEffortOptions = {
  onEffortConflict?: () => void
}

function invalidateTasksAndHorizon(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: tasksQueryKey }),
    queryClient.invalidateQueries({ queryKey: horizonQueryPrefix }),
  ])
}

export function useTasks() {
  const query = useQuery({
    queryKey: tasksQueryKey,
    queryFn: listTasks,
  })

  return {
    ...query,
    tasks: query.data ?? [],
    isEmpty: query.data != null && query.data.length === 0,
  }
}

export function useCreateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: createTaskMutationKey,
    mutationFn: (request: CreateTaskRequest) => createTask(request),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await invalidateTasksAndHorizon(queryClient)
    },
  })
}

export function useUpdateTask(options?: UseUpdateTaskOptions) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: options?.mutationKey ?? updateTaskMutationKey,
    mutationFn: ({
      id,
      request,
    }: {
      id: number
      request: UpdateTaskRequest
    }) => updateTask(id, request),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await invalidateTasksAndHorizon(queryClient)
    },
    onError: async (error) => {
      if (isProgressConflict(error)) {
        await invalidateTasksAndHorizon(queryClient)
        options?.onEffortConflict?.()
      }
    },
  })
}

export function useAddBlocker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      blockerTaskId,
    }: {
      id: number
      blockerTaskId: number
    }) => addBlocker(id, { blockerTaskId }),
    onSuccess: async () => {
      await invalidateTasksAndHorizon(queryClient)
    },
  })
}

export function useRemoveBlocker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, blockerId }: { id: number; blockerId: number }) =>
      removeBlocker(id, blockerId),
    onSuccess: async () => {
      await invalidateTasksAndHorizon(queryClient)
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await invalidateTasksAndHorizon(queryClient)
    },
  })
}

export function useReassessRemainingEffort(
  options?: UseReassessRemainingEffortOptions,
) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: reassessRemainingEffortMutationKey,
    mutationFn: ({
      id,
      request,
    }: {
      id: number
      request: RemainingEffortRequest
    }) => reassessRemainingEffort(id, request),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await invalidateTasksAndHorizon(queryClient)
    },
    onError: async (error) => {
      if (isProgressConflict(error)) {
        await invalidateTasksAndHorizon(queryClient)
        options?.onEffortConflict?.()
      }
    },
  })
}
