import { apiRequest } from '@/lib/api'
import type {
  CreateTaskRequest,
  RemainingEffortRequest,
  TaskResponse,
  UpdateTaskRequest,
} from '@/types/api'

export async function listTasks(): Promise<TaskResponse[]> {
  return apiRequest<TaskResponse[]>('/api/tasks')
}

export async function createTask(
  request: CreateTaskRequest,
): Promise<TaskResponse> {
  return apiRequest<TaskResponse>('/api/tasks', {
    method: 'POST',
    body: request,
  })
}

export async function updateTask(
  id: number,
  request: UpdateTaskRequest,
): Promise<TaskResponse> {
  return apiRequest<TaskResponse>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: request,
  })
}

export async function reassessRemainingEffort(
  id: number,
  request: RemainingEffortRequest,
): Promise<TaskResponse> {
  return apiRequest<TaskResponse>(`/api/tasks/${id}/remaining-effort`, {
    method: 'POST',
    body: request,
  })
}

export async function deleteTask(id: number): Promise<void> {
  return apiRequest<void>(`/api/tasks/${id}`, {
    method: 'DELETE',
  })
}
