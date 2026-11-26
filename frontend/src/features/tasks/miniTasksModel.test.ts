import { describe, expect, it } from 'vitest'

import { miniTaskRows } from '@/features/tasks/miniTasksModel'
import type { TaskResponse } from '@/types/api'

function task(overrides: Partial<TaskResponse> & Pick<TaskResponse, 'id' | 'title'>): TaskResponse {
  return {
    description: null,
    priority: 'MEDIUM',
    status: 'OPEN',
    dueDate: null,
    estimatedMinutes: 30,
    remainingEffortMinutes: 30,
    effortVersion: 1,
    blockedBy: [],
    blocks: [],
    ...overrides,
  }
}

const tasks: TaskResponse[] = [
  task({ id: 1, title: 'No due high', priority: 'HIGH' }),
  task({ id: 2, title: 'Due low', priority: 'LOW', dueDate: '2026-11-20' }),
  task({ id: 3, title: 'Due high', priority: 'HIGH', dueDate: '2026-11-20' }),
  task({ id: 4, title: 'Done', priority: 'HIGH', dueDate: '2026-11-10', status: 'DONE' }),
  task({
    id: 5,
    title: 'No effort',
    dueDate: '2026-11-21',
    status: 'IN_PROGRESS',
    remainingEffortMinutes: null,
  }),
  task({
    id: 6,
    title: 'Blocked no effort',
    dueDate: '2026-11-22',
    remainingEffortMinutes: null,
    blockedBy: [{ taskId: 1, title: 'No due high', status: 'OPEN' }],
  }),
]

describe('miniTaskRows', () => {
  it('keeps active tasks, ordered by due date then priority, with undated work last', () => {
    expect(miniTaskRows(tasks).map((row) => row.task.id)).toEqual([3, 2, 5, 6, 1])
  })

  it('flags an active task with no remaining effort and no active blocker as unplaced', () => {
    const byId = new Map(miniTaskRows(tasks).map((row) => [row.task.id, row]))

    expect(byId.get(5)?.unplaced).toBe(true)
    expect(byId.get(6)?.unplaced).toBe(false)
    expect(byId.get(1)?.unplaced).toBe(false)
  })
})
