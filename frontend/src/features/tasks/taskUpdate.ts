import type { TaskResponse, UpdateTaskRequest } from '@/types/api'

export function buildTaskUpdateRequest(
  task: TaskResponse,
  overrides: Partial<UpdateTaskRequest> = {},
): UpdateTaskRequest {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    effortVersion: task.effortVersion,
    ...overrides,
  }
}
