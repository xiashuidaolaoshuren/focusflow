import { describe, expect, it } from 'vitest'

import { filterTasks, searchTasks, sortTasks, tabCounts } from '@/features/tasks/taskListModel'
import type { TaskResponse, TaskStatus } from '@/types/api'

function task(id: number, status: TaskStatus, overrides: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id,
    title: `Task ${id}`,
    description: null,
    priority: 'MEDIUM',
    status,
    dueDate: null,
    estimatedMinutes: null,
    remainingEffortMinutes: null,
    effortVersion: 0,
    blockedBy: [],
    blocks: [],
    ...overrides,
  }
}

const mixed = [
  task(1, 'OPEN'),
  task(2, 'IN_PROGRESS'),
  task(3, 'DONE'),
  task(4, 'CANCELLED'),
]

describe('taskListModel', () => {
  it('counts each tab and keeps Active to Open and In progress', () => {
    expect(tabCounts(mixed)).toEqual({
      active: 2,
      done: 1,
      cancelled: 1,
      all: 4,
    })
    expect(filterTasks(mixed, 'active').map((entry) => entry.id)).toEqual([1, 2])
    expect(filterTasks(mixed, 'done').map((entry) => entry.id)).toEqual([3])
    expect(filterTasks(mixed, 'cancelled').map((entry) => entry.id)).toEqual([4])
    expect(filterTasks(mixed, 'all').map((entry) => entry.id)).toEqual([
      1, 2, 3, 4,
    ])
  })

  it('searches titles only, ignoring case and surrounding space', () => {
    const tasks = [
      task(1, 'OPEN', { title: 'Write report' }),
      task(2, 'OPEN', { title: 'Tidy desk', description: 'Write report later' }),
    ]

    expect(searchTasks(tasks, '  report ').map((entry) => entry.id)).toEqual([1])
    expect(searchTasks(tasks, 'REPORT').map((entry) => entry.id)).toEqual([1])
    expect(searchTasks(tasks, '').map((entry) => entry.id)).toEqual([1, 2])
  })

  it('sorts by due date, priority, and remaining effort with nulls last', () => {
    const due = [
      task(1, 'OPEN', { dueDate: '2026-06-10' }),
      task(2, 'OPEN', { dueDate: null }),
      task(3, 'OPEN', { dueDate: '2026-06-01' }),
    ]
    expect(sortTasks(due, 'due').map((entry) => entry.id)).toEqual([3, 1, 2])

    const priority = [
      task(1, 'OPEN', { priority: 'LOW' }),
      task(2, 'OPEN', { priority: 'HIGH' }),
      task(3, 'OPEN', { priority: 'MEDIUM' }),
    ]
    expect(sortTasks(priority, 'priority').map((entry) => entry.id)).toEqual([
      2, 3, 1,
    ])

    const effort = [
      task(1, 'OPEN', { remainingEffortMinutes: 10 }),
      task(2, 'OPEN', { remainingEffortMinutes: null }),
      task(3, 'OPEN', { remainingEffortMinutes: 50 }),
    ]
    expect(sortTasks(effort, 'effort').map((entry) => entry.id)).toEqual([
      3, 1, 2,
    ])
  })

  it('breaks ties by title and then id', () => {
    const tasks = [
      task(3, 'OPEN', { title: 'Beta', dueDate: '2026-06-01' }),
      task(2, 'OPEN', { title: 'Alpha', dueDate: '2026-06-01' }),
      task(1, 'OPEN', { title: 'Beta', dueDate: '2026-06-01' }),
    ]

    expect(sortTasks(tasks, 'due').map((entry) => entry.id)).toEqual([2, 1, 3])
  })
})
