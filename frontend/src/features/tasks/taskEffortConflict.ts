import { ApiError } from '@/lib/api'

export const PROGRESS_CONFLICT_MESSAGE =
  'Your change was not saved because a newer update was kept. The task list has been refreshed.'

export function isProgressConflict(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code === 'PROGRESS_CONFLICT'
  )
}
