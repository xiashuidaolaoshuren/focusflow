import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, within } from '@testing-library/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(),
    useCreateTask: vi.fn(),
    useUpdateTask: vi.fn(),
    useDeleteTask: vi.fn(),
    useAddBlocker: vi.fn(),
    useRemoveBlocker: vi.fn(),
    useReassessRemainingEffort: vi.fn(),
  }
})

vi.mock('@/features/horizon/hooks', () => ({
  useHorizon: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import { useHorizon } from '@/features/horizon/hooks'
import {
  useAddBlocker,
  useCreateTask,
  useDeleteTask,
  useReassessRemainingEffort,
  useRemoveBlocker,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks'
import { TasksPage } from '@/routes/TasksPage'
import type { HorizonTaskRowResponse, TaskResponse } from '@/types/api'

const mockedUseTasks = vi.mocked(useTasks)
const mockedUseHorizon = vi.mocked(useHorizon)

export const sampleTask: TaskResponse = {
  id: 1,
  title: 'Write report',
  description: 'Quarterly summary',
  priority: 'HIGH',
  status: 'OPEN',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 0,
  blockedBy: [
    { taskId: 11, title: 'Collect data', status: 'OPEN' },
    { taskId: 12, title: 'Draft outline', status: 'IN_PROGRESS' },
    { taskId: 13, title: 'Old blocker', status: 'DONE' },
  ],
  blocks: [{ taskId: 14, title: 'Publish', status: 'OPEN' }],
}

function horizonRow(overrides: Partial<HorizonTaskRowResponse> = {}): HorizonTaskRowResponse {
  return {
    taskId: 1,
    title: 'Write report',
    status: 'OPEN',
    dueDate: '2026-06-15',
    remainingEffortMinutes: 25,
    deadlineStatus: 'AT_RISK',
    projectedFinishDate: '2026-06-18',
    waitingOn: [],
    upstreamBlockers: [],
    unresolvedEffort: [],
    segments: [],
    ...overrides,
  }
}

function mockTasks(tasks: TaskResponse[]) {
  mockedUseTasks.mockReturnValue({
    tasks,
    isEmpty: tasks.length === 0,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useTasks>)
}

function mockHorizon(rows: HorizonTaskRowResponse[], options: {
  isError?: boolean
  refetch?: () => void
} = {}) {
  mockedUseHorizon.mockReturnValue({
    horizon: {
      currentDate: '2026-06-15',
      currentTime: '09:00:00',
      assumptions: { pace: 'AS_PLANNED', workingDays: [], horizonWorkingDays: 7 },
      days: [],
      tasks: rows,
    },
    isPending: false,
    isError: options.isError ?? false,
    refetch: options.refetch ?? vi.fn(),
  } as unknown as ReturnType<typeof useHorizon>)
}

function mockMutation() {
  return { mutate: vi.fn(), isPending: false } as unknown
}

function mockIdleMutations() {
  vi.mocked(useCreateTask).mockReturnValue(mockMutation() as ReturnType<typeof useCreateTask>)
  vi.mocked(useUpdateTask).mockReturnValue(mockMutation() as ReturnType<typeof useUpdateTask>)
  vi.mocked(useDeleteTask).mockReturnValue(mockMutation() as ReturnType<typeof useDeleteTask>)
  vi.mocked(useAddBlocker).mockReturnValue(mockMutation() as ReturnType<typeof useAddBlocker>)
  vi.mocked(useRemoveBlocker).mockReturnValue(mockMutation() as ReturnType<typeof useRemoveBlocker>)
  vi.mocked(useReassessRemainingEffort).mockReturnValue(
    mockMutation() as ReturnType<typeof useReassessRemainingEffort>,
  )
}

export function renderTasks() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TasksPage />
    </QueryClientProvider>,
  )
}

describe('TasksPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1280,
    })
    mockIdleMutations()
    mockHorizon([horizonRow()])
    mockTasks([sampleTask])
  })

  it('shows a compact row with status, due, effort, dependencies, and forecast', () => {
    renderTasks()

    const table = screen.getByRole('table', { name: /tasks/i })
    const row = within(table).getAllByRole('row')[1]!

    expect(row).toHaveTextContent('Write report')
    expect(row).toHaveTextContent('Open')
    expect(row).toHaveTextContent('15 Jun 2026')
    expect(row).toHaveTextContent('25m')
    expect(row).toHaveTextContent('of 60m')
    expect(row).toHaveTextContent('Blocked by 2')
    expect(row).toHaveTextContent('Blocks 1')
    expect(row).toHaveTextContent('At risk')
    expect(row).toHaveTextContent('Waiting on Collect data, Draft outline')
  })

  it('opens Edit with the saved values, then a New task starts empty', () => {
    renderTasks()

    fireEvent.click(screen.getByRole('button', { name: 'Write report' }))
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('Write report')
    expect(screen.getByRole('textbox', { name: /description/i })).toHaveValue('Quarterly summary')

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /new task/i })[0]!)
    expect(screen.getByRole('textbox', { name: /^title/i })).toHaveValue('')
  })

  it('shows every forecast state on the task rows, including on track and beyond horizon', () => {
    mockHorizon([horizonRow({ deadlineStatus: 'ON_TRACK' })])
    const { unmount } = renderTasks()
    expect(screen.getByText('On track')).toBeInTheDocument()
    unmount()

    mockHorizon([horizonRow({ deadlineStatus: 'BEYOND_HORIZON' })])
    renderTasks()
    expect(screen.getByText('Beyond horizon')).toBeInTheDocument()
  })

  it('explains the deadline forecast states behind an ⓘ in the header', () => {
    renderTasks()

    fireEvent.click(screen.getByRole('button', { name: /about deadline forecasts/i }))
    for (const text of ['On track', 'Overdue', "Can't forecast", 'Beyond horizon']) {
      expect(screen.getByText(text)).toBeInTheDocument()
    }
  })

  it('fills the priority flag by level: full for high, half for medium, empty for low', () => {
    const levels = [
      ['HIGH', 'full'],
      ['MEDIUM', 'half'],
      ['LOW', 'empty'],
    ] as const
    for (const [priority, fill] of levels) {
      mockTasks([{ ...sampleTask, priority }])
      const { unmount } = renderTasks()
      const flag = screen.getAllByText(`${priority[0]}${priority.slice(1).toLowerCase()} priority`)[0]!
        .closest('[data-fill]')
      expect(flag).toHaveAttribute('data-fill', fill)
      unmount()
    }
  })

  it('filters by tab, searches titles, and sorts the rows', () => {
    const done: TaskResponse = {
      ...sampleTask,
      id: 2,
      title: 'Archived report',
      status: 'DONE',
    }
    const later: TaskResponse = {
      ...sampleTask,
      id: 3,
      title: 'Low priority errand',
      priority: 'LOW',
      dueDate: '2026-07-01',
      remainingEffortMinutes: 5,
    }
    mockTasks([sampleTask, done, later])
    mockHorizon([])

    renderTasks()

    fireEvent.click(screen.getByRole('tab', { name: /^Done/ }))
    expect(screen.getByText('Archived report')).toBeInTheDocument()
    expect(screen.queryByText('Write report')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: /^Active/ }))
    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), {
      target: { value: 'write' },
    })
    expect(screen.getByText('Write report')).toBeInTheDocument()
    expect(screen.queryByText('Low priority errand')).toBeNull()

    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: /sort/i }), {
      target: { value: 'priority' },
    })
    const titles = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.textContent)
    expect(titles[0]).toContain('Write report')
    expect(titles[1]).toContain('Low priority errand')
  })

  it('shows skeleton rows while loading', () => {
    mockedUseTasks.mockReturnValue({
      tasks: [],
      isEmpty: false,
      isPending: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)

    renderTasks()

    expect(screen.getByRole('status', { name: /loading tasks/i })).toBeInTheDocument()
  })

  it('shows an error with a retry that refetches', () => {
    const refetch = vi.fn()
    mockedUseTasks.mockReturnValue({
      tasks: [],
      isEmpty: false,
      isPending: false,
      isError: true,
      error: new Error('boom'),
      refetch,
    } as unknown as ReturnType<typeof useTasks>)

    renderTasks()

    expect(screen.getByRole('alert')).toHaveTextContent(/could not be loaded/i)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('shows the empty state with a New task action', () => {
    mockTasks([])
    mockHorizon([])

    renderTasks()

    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(
      within(screen.getByRole('tabpanel')).getByRole('button', {
        name: /new task/i,
      }),
    ).toBeInTheDocument()
  })

  it('says when a search or tab matches nothing', () => {
    renderTasks()

    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), {
      target: { value: 'zzz' },
    })

    expect(screen.getByText(/no tasks match/i)).toBeInTheDocument()
  })

  it('renders cards instead of a table below 768px', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    })

    renderTasks()

    expect(screen.queryByRole('table')).toBeNull()
    const list = screen.getByRole('list', { name: /tasks/i })
    expect(within(list).getByText('Write report')).toBeInTheDocument()
  })

  it('opens the editor sheet from a row and from New task', () => {
    renderTasks()

    fireEvent.click(screen.getByRole('button', { name: 'Write report' }))
    expect(
      screen.getByRole('heading', { name: /edit task/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /new task/i })[0]!)
    expect(
      screen.getByRole('heading', { name: /new task/i }),
    ).toBeInTheDocument()
  })

  it('keeps the rows when the horizon forecast fails and offers a retry', () => {
    const refetch = vi.fn()
    mockHorizon([], { isError: true, refetch })

    renderTasks()

    expect(screen.getByText('Write report')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
