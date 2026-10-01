import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { markRegeneratePromptNeeded } from '@/features/plans/regeneratePrompt'
import { createTask, deleteTask, listTasks, updateTask } from '@/features/tasks/api'
import type { CreateTaskRequest, UpdateTaskRequest } from '@/types/api'

export const tasksQueryKey = ['tasks', 'list'] as const
export const createTaskMutationKey = ['tasks', 'create'] as const
export const updateTaskMutationKey = ['tasks', 'update'] as const
export const formUpdateTaskMutationKey = ['tasks', 'form-update'] as const

type UseUpdateTaskOptions = {
  mutationKey?: readonly string[]
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
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey })
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
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    },
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: async () => {
      markRegeneratePromptNeeded()
      await queryClient.invalidateQueries({ queryKey: tasksQueryKey })
    },
  })
}
