import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { MiniTasksCard } from '@/features/tasks/MiniTasksCard'
import { getLocalDateString } from '@/lib/planningDate'
import type { HorizonTaskRowResponse, TaskResponse } from '@/types/api'

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

function renderCard(
  tasks: TaskResponse[],
  horizonRowByTaskId = new Map<number, HorizonTaskRowResponse>(),
) {
  return render(
    <MemoryRouter>
      <MiniTasksCard tasks={tasks} horizonRowByTaskId={horizonRowByTaskId} />
    </MemoryRouter>,
  )
}

describe('MiniTasksCard', () => {
  it('counts active tasks, links to the full list, and shows each row with its badges', () => {
    const forecast: HorizonTaskRowResponse = {
      taskId: 2,
      title: 'Ship release',
      status: 'OPEN',
      dueDate: '2026-11-20',
      remainingEffortMinutes: 40,
      deadlineStatus: 'AT_RISK',
      projectedFinishDate: '2026-11-21',
      waitingOn: [],
      upstreamBlockers: [],
      unresolvedEffort: [],
      segments: [],
    }
    renderCard(
      [
        task({ id: 1, title: 'Write report', priority: 'HIGH' }),
        task({ id: 2, title: 'Ship release', dueDate: '2026-11-20' }),
        task({ id: 3, title: 'Finished', status: 'DONE' }),
      ],
      new Map([[2, forecast]]),
    )

    expect(screen.getByRole('heading', { name: 'Tasks' })).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All tasks' })).toHaveAttribute('href', '/tasks')
    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.getByText('Ship release')).toBeInTheDocument()
    expect(screen.getByText('At risk · 20 Nov 2026')).toBeInTheDocument()
    expect(screen.queryByText('Finished')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About deadline forecasts' })).toBeInTheDocument()
  })

  it('marks a task with no estimate and no blocker as unplaced', () => {
    renderCard([task({ id: 1, title: 'Draft memo', remainingEffortMinutes: null })])

    expect(screen.getByText('Unplaced')).toBeInTheDocument()
  })

  it('shows remaining effort against the estimate', () => {
    renderCard([
      task({ id: 1, title: 'Plan offsite', estimatedMinutes: 120, remainingEffortMinutes: 90 }),
    ])

    expect(screen.getByText('90m')).toBeInTheDocument()
    expect(screen.getByText('of 120m')).toBeInTheDocument()
  })

  it('names the open blocker a task is waiting on', () => {
    renderCard([
      task({
        id: 2,
        title: 'Ship release',
        blockedBy: [{ taskId: 1, title: 'Write report', status: 'OPEN' }],
      }),
    ])

    expect(screen.getByText('Waiting on Write report')).toBeInTheDocument()
  })

  it('adds the due day to a deadline badge', () => {
    const today = getLocalDateString()
    const forecast: HorizonTaskRowResponse = {
      taskId: 2,
      title: 'Ship release',
      status: 'OPEN',
      dueDate: today,
      remainingEffortMinutes: 40,
      deadlineStatus: 'AT_RISK',
      projectedFinishDate: today,
      waitingOn: [],
      upstreamBlockers: [],
      unresolvedEffort: [],
      segments: [],
    }
    renderCard(
      [task({ id: 2, title: 'Ship release', dueDate: today })],
      new Map([[2, forecast]]),
    )

    expect(screen.getByText('At risk · Today')).toBeInTheDocument()
  })

  it('shows an empty state when no task is active', () => {
    renderCard([task({ id: 1, title: 'Finished', status: 'DONE' })])

    expect(screen.getByText('No active tasks')).toBeInTheDocument()
  })
})
