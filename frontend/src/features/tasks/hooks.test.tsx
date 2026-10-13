import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import type { TaskResponse } from '@/types/api'

import {
  tasksQueryKey,
  useAddBlocker,
  useCreateTask,
  useDeleteTask,
  useReassessRemainingEffort,
  useRemoveBlocker,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks'

vi.mock('@/features/plans/regeneratePrompt', () => ({
  markRegeneratePromptNeeded: vi.fn(),
}))

vi.mock('@/features/tasks/api', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  reassessRemainingEffort: vi.fn(),
  addBlocker: vi.fn(),
  removeBlocker: vi.fn(),
}))

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

const mockedListTasks = vi.mocked(listTasks)
const mockedCreateTask = vi.mocked(createTask)
const mockedUpdateTask = vi.mocked(updateTask)
const mockedDeleteTask = vi.mocked(deleteTask)
const mockedReassessRemainingEffort = vi.mocked(reassessRemainingEffort)
const mockedAddBlocker = vi.mocked(addBlocker)
const mockedRemoveBlocker = vi.mocked(removeBlocker)
const mockedMarkRegeneratePromptNeeded = vi.mocked(markRegeneratePromptNeeded)

const progressConflictError = new ApiError({
  status: 409,
  message: 'task effort has changed',
  code: 'PROGRESS_CONFLICT',
})

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  }
}

describe('useTasks', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses a stable query key for the task list', () => {
    expect(tasksQueryKey).toEqual(['tasks', 'list'])
  })

  it('returns tasks when the query succeeds', async () => {
    const tasks: TaskResponse[] = [
      {
        id: 1,
        title: 'Task A',
        description: null,
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: '2026-06-15',
        estimatedMinutes: 30,
        remainingEffortMinutes: 30,
        effortVersion: 0,
        blockedBy: [],
        blocks: [],
      },
    ]
    mockedListTasks.mockResolvedValue(tasks)

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedListTasks).toHaveBeenCalled()
    expect(result.current.data).toEqual(tasks)
    expect(result.current.isEmpty).toBe(false)
  })

  it('returns empty state when the user has no tasks', async () => {
    mockedListTasks.mockResolvedValue([])

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([])
    expect(result.current.isEmpty).toBe(true)
  })

  it('surfaces query errors', async () => {
    mockedListTasks.mockRejectedValue(
      new ApiError({ status: 500, message: 'Server error' }),
    )

    const { result } = renderHook(() => useTasks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toMatchObject({
      status: 500,
      message: 'Server error',
    })
  })
})

describe('useCreateTask', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls createTask and invalidates the task list on success', async () => {
    const created: TaskResponse = {
      id: 3,
      title: 'Write tests',
      description: 'TDD coverage',
      priority: 'HIGH',
      status: 'OPEN',
      dueDate: '2026-06-01',
      estimatedMinutes: 45,
      remainingEffortMinutes: 45,
      effortVersion: 0,
      blockedBy: [],
      blocks: [],
    }
    mockedCreateTask.mockResolvedValue(created)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useCreateTask(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      title: 'Write tests',
      description: 'TDD coverage',
      priority: 'HIGH',
      dueDate: '2026-06-01',
      estimatedMinutes: 45,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedCreateTask).toHaveBeenCalledWith({
      title: 'Write tests',
      description: 'TDD coverage',
      priority: 'HIGH',
      dueDate: '2026-06-01',
      estimatedMinutes: 45,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tasksQueryKey,
    })
  })
})

describe('useUpdateTask', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls updateTask and invalidates the task list on success', async () => {
    const updated: TaskResponse = {
      id: 1,
      title: 'Updated title',
      description: 'Updated description',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-06-10',
      estimatedMinutes: 60,
      remainingEffortMinutes: 25,
      effortVersion: 2,
      blockedBy: [],
      blocks: [],
    }
    mockedUpdateTask.mockResolvedValue(updated)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 1,
      request: {
        title: 'Updated title',
        description: 'Updated description',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-06-10',
        estimatedMinutes: 60,
      },
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedUpdateTask).toHaveBeenCalledWith(1, {
      title: 'Updated title',
      description: 'Updated description',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-06-10',
      estimatedMinutes: 60,
    })
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tasksQueryKey,
    })
  })

  it('refetches the task list on PROGRESS_CONFLICT without a success invalidation', async () => {
    mockedUpdateTask.mockRejectedValue(progressConflictError)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useUpdateTask(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 1,
      request: {
        title: 'Updated title',
        description: 'Updated description',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-06-10',
        estimatedMinutes: 60,
        effortVersion: 1,
      },
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tasksQueryKey,
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(result.current.isSuccess).toBe(false)
  })
})

describe('useReassessRemainingEffort', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('refetches the task list on PROGRESS_CONFLICT without a success invalidation', async () => {
    mockedReassessRemainingEffort.mockRejectedValue(progressConflictError)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useReassessRemainingEffort(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      id: 1,
      request: {
        remainingEffortMinutes: 40,
        currentDate: '2026-06-15',
        effortVersion: 2,
      },
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tasksQueryKey,
    })
    expect(invalidateSpy).toHaveBeenCalledTimes(1)
    expect(result.current.isSuccess).toBe(false)
  })
})

describe('useAddBlocker', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates the task list on success and does not mark a plan refresh', async () => {
    mockedAddBlocker.mockResolvedValue({
      id: 1,
      title: 'Blocked task',
      description: null,
      priority: 'HIGH',
      status: 'OPEN',
      dueDate: null,
      estimatedMinutes: 30,
      remainingEffortMinutes: 30,
      effortVersion: 0,
      blockedBy: [{ taskId: 2, title: 'Blocker', status: 'OPEN' }],
      blocks: [],
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useAddBlocker(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ id: 1, blockerTaskId: 2 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedAddBlocker).toHaveBeenCalledWith(1, { blockerTaskId: 2 })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tasksQueryKey })
    expect(mockedMarkRegeneratePromptNeeded).not.toHaveBeenCalled()
  })
})

describe('useRemoveBlocker', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('invalidates the task list on success and does not mark a plan refresh', async () => {
    mockedRemoveBlocker.mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useRemoveBlocker(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ id: 1, blockerId: 2 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedRemoveBlocker).toHaveBeenCalledWith(1, 2)
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tasksQueryKey })
    expect(mockedMarkRegeneratePromptNeeded).not.toHaveBeenCalled()
  })
})

describe('useDeleteTask', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls deleteTask and invalidates the task list on success', async () => {
    mockedDeleteTask.mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')

    const { result } = renderHook(() => useDeleteTask(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate(1)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedDeleteTask).toHaveBeenCalledWith(1)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tasksQueryKey,
    })
  })
})
