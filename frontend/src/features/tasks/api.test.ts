import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TaskResponse } from '@/types/api'

import {
  addBlocker,
  createTask,
  deleteTask,
  listTasks,
  reassessRemainingEffort,
  removeBlocker,
  updateTask,
} from '@/features/tasks/api'

describe('listTasks', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns tasks on success', async () => {
    const tasks: TaskResponse[] = [
      {
        id: 1,
        title: 'Task A',
        description: 'First task',
        priority: 'HIGH',
        status: 'OPEN',
        dueDate: '2026-06-15',
        estimatedMinutes: 30,
        remainingEffortMinutes: 30,
        effortVersion: 0,
        blockedBy: [],
        blocks: [],
      },
      {
        id: 2,
        title: 'Task B',
        description: null,
        priority: 'MEDIUM',
        status: 'IN_PROGRESS',
        dueDate: '2026-06-20',
        estimatedMinutes: 45,
        remainingEffortMinutes: 45,
        effortVersion: 1,
        blockedBy: [],
        blocks: [],
      },
    ]
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(tasks), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listTasks()).resolves.toEqual(tasks)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('returns an empty array when the user has no tasks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(listTasks()).resolves.toEqual([])
  })

  it('rethrows ApiError on non-2xx responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 500,
            message: 'Server error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(listTasks()).rejects.toMatchObject({
      status: 500,
      message: 'Server error',
    })
  })
})

describe('createTask', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a task on success (201)', async () => {
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(created), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createTask({
        title: 'Write tests',
        description: 'TDD coverage',
        priority: 'HIGH',
        dueDate: '2026-06-01',
        estimatedMinutes: 45,
      }),
    ).resolves.toEqual(created)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          title: 'Write tests',
          description: 'TDD coverage',
          priority: 'HIGH',
          dueDate: '2026-06-01',
          estimatedMinutes: 45,
        }),
      }),
    )
  })

  it('rethrows ApiError on validation failure (400)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 400,
            message: 'Validation failed',
            details: { title: ['must not be blank'] },
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(createTask({ title: '' })).rejects.toMatchObject({
      status: 400,
      message: 'Validation failed',
      details: { title: ['must not be blank'] },
    })
  })

  it('rethrows ApiError on server failure (500)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 500,
            message: 'Server error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(createTask({ title: 'Write tests' })).rejects.toMatchObject({
      status: 500,
      message: 'Server error',
    })
  })
})

describe('updateTask', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('updates a task on success (200)', async () => {
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateTask(1, {
        title: 'Updated title',
        description: 'Updated description',
        priority: 'HIGH',
        status: 'IN_PROGRESS',
        dueDate: '2026-06-10',
        estimatedMinutes: 60,
      }),
    ).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/1'),
      expect.objectContaining({
        method: 'PUT',
        credentials: 'include',
        body: JSON.stringify({
          title: 'Updated title',
          description: 'Updated description',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          dueDate: '2026-06-10',
          estimatedMinutes: 60,
        }),
      }),
    )
  })
})

describe('reassessRemainingEffort', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts RemainingEffortRequest to the remaining-effort route', async () => {
    const response: TaskResponse = {
      id: 1,
      title: 'Write report',
      description: null,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      dueDate: '2026-06-15',
      estimatedMinutes: 60,
      remainingEffortMinutes: 40,
      effortVersion: 3,
      blockedBy: [],
      blocks: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      reassessRemainingEffort(1, {
        remainingEffortMinutes: 40,
        currentDate: '2026-06-15',
        effortVersion: 2,
      }),
    ).resolves.toEqual(response)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/1/remaining-effort'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          remainingEffortMinutes: 40,
          currentDate: '2026-06-15',
          effortVersion: 2,
        }),
      }),
    )
  })
})

describe('addBlocker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts AddBlockerRequest to the blockers route', async () => {
    const updated: TaskResponse = {
      id: 1,
      title: 'Blocked task',
      description: null,
      priority: 'HIGH',
      status: 'OPEN',
      dueDate: '2026-06-15',
      estimatedMinutes: 60,
      remainingEffortMinutes: 60,
      effortVersion: 0,
      blockedBy: [{ taskId: 2, title: 'Blocker', status: 'OPEN' }],
      blocks: [],
    }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(updated), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(addBlocker(1, { blockerTaskId: 2 })).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/1/blockers'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ blockerTaskId: 2 }),
      }),
    )
  })
})

describe('removeBlocker', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes the blocker link on success (204)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(removeBlocker(1, 2)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/1/blockers/2'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }),
    )
  })
})

describe('deleteTask', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('deletes a task on success (204)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteTask(1)).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/1'),
      expect.objectContaining({
        method: 'DELETE',
        credentials: 'include',
      }),
    )
  })
})
