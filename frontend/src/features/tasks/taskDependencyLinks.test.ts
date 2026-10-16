import { describe, expect, it } from 'vitest'

import { liveNeededForLabel } from '@/features/tasks/taskDependencyLinks'
import type { TaskResponse } from '@/types/api'

const PLANNING_DATE = '2026-06-15'

function task(
  partial: Partial<TaskResponse> & { id: number; title: string },
): TaskResponse {
  return {
    description: null,
    priority: 'MEDIUM',
    status: 'OPEN',
    dueDate: null,
    estimatedMinutes: null,
    remainingEffortMinutes: null,
    effortVersion: 0,
    blockedBy: [],
    blocks: [],
    ...partial,
  }
}

function byId(tasks: TaskResponse[]): Map<number, TaskResponse> {
  return new Map(tasks.map((entry) => [entry.id, entry]))
}

describe('liveNeededForLabel', () => {
  it('names the plannable task that promoted an undated blocker', () => {
    const blocker = task({
      id: 1,
      title: 'Draft outline',
      blocks: [{ taskId: 2, title: 'Write report', status: 'OPEN' }],
    })
    const blocked = task({
      id: 2,
      title: 'Write report',
      dueDate: PLANNING_DATE,
    })

    expect(
      liveNeededForLabel(blocker, byId([blocker, blocked]), PLANNING_DATE),
    ).toBe('Needed for Write report (due 2026-06-15)')
  })

  it('returns null when the task already holds the inherited group', () => {
    const blocker = task({
      id: 1,
      title: 'Continue',
      status: 'IN_PROGRESS',
      blocks: [{ taskId: 2, title: 'Continue too', status: 'IN_PROGRESS' }],
    })
    const blocked = task({
      id: 2,
      title: 'Continue too',
      status: 'IN_PROGRESS',
      dueDate: PLANNING_DATE,
    })

    expect(
      liveNeededForLabel(blocker, byId([blocker, blocked]), PLANNING_DATE),
    ).toBeNull()
  })

  it('does not inherit urgency through a finished task', () => {
    const blocker = task({
      id: 1,
      title: 'Upstream',
      blocks: [{ taskId: 2, title: 'Finished', status: 'DONE' }],
    })
    const finished = task({
      id: 2,
      title: 'Finished',
      status: 'DONE',
      blocks: [{ taskId: 3, title: 'Due work', status: 'OPEN' }],
    })
    const due = task({ id: 3, title: 'Due work', dueDate: PLANNING_DATE })

    expect(
      liveNeededForLabel(blocker, byId([blocker, finished, due]), PLANNING_DATE),
    ).toBeNull()
  })

  it('prefers the earliest due date among the promoted group', () => {
    const blocker = task({
      id: 1,
      title: 'Upstream',
      blocks: [
        { taskId: 20, title: 'Earlier', status: 'OPEN' },
        { taskId: 10, title: 'Later', status: 'OPEN' },
      ],
    })
    const earlier = task({ id: 20, title: 'Earlier', dueDate: '2026-06-10' })
    const later = task({ id: 10, title: 'Later', dueDate: '2026-06-12' })

    expect(
      liveNeededForLabel(
        blocker,
        byId([blocker, earlier, later]),
        PLANNING_DATE,
      ),
    ).toBe('Needed for Earlier (due 2026-06-10)')
  })
})
