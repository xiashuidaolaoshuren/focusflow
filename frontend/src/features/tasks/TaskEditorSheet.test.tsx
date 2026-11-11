import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useTasks: vi.fn(),
    useCreateTask: vi.fn(),
    useUpdateTask: vi.fn(),
    useAddBlocker: vi.fn(),
    useRemoveBlocker: vi.fn(),
    useReassessRemainingEffort: vi.fn(),
  }
})

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import { ApiError } from '@/lib/api'
import {
  useAddBlocker,
  useCreateTask,
  useReassessRemainingEffort,
  useRemoveBlocker,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks'
import { TaskEditorSheet } from '@/features/tasks/TaskEditorSheet'
import type { TaskResponse } from '@/types/api'

const mockedUseTasks = vi.mocked(useTasks)

const sampleTask: TaskResponse = {
  id: 1,
  title: 'Write report',
  description: 'Quarterly summary',
  priority: 'HIGH',
  status: 'OPEN',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 0,
  blockedBy: [],
  blocks: [],
}

function mutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  }
}

const create = mutation()
const update = mutation()
const addBlocker = mutation()
const removeBlocker = mutation()

function renderSheet(
  options: { task?: TaskResponse | null; onOpenChange?: (open: boolean) => void } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TaskEditorSheet
        open
        task={options.task ?? null}
        onOpenChange={options.onOpenChange ?? vi.fn()}
      />
    </QueryClientProvider>,
  )
}

describe('TaskEditorSheet', () => {
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
    mockedUseTasks.mockReturnValue({
      tasks: [sampleTask],
      isPending: false,
      isError: false,
      isEmpty: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)
    vi.mocked(useCreateTask).mockReturnValue(
      create as unknown as ReturnType<typeof useCreateTask>,
    )
    vi.mocked(useUpdateTask).mockReturnValue(
      update as unknown as ReturnType<typeof useUpdateTask>,
    )
    vi.mocked(useAddBlocker).mockReturnValue(
      addBlocker as unknown as ReturnType<typeof useAddBlocker>,
    )
    vi.mocked(useRemoveBlocker).mockReturnValue(
      removeBlocker as unknown as ReturnType<typeof useRemoveBlocker>,
    )
    vi.mocked(useReassessRemainingEffort).mockReturnValue(
      mutation() as unknown as ReturnType<typeof useReassessRemainingEffort>,
    )
    vi.clearAllMocks()
  })

  it('validates the title and creates a task through the existing mutation', async () => {
    const onOpenChange = vi.fn()
    renderSheet({ onOpenChange })

    expect(
      screen.getByRole('heading', { name: /new task/i }),
    ).toBeInTheDocument()

    fireEvent.submit(screen.getByRole('form', { name: /task details/i }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(create.mutate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Draft proposal' },
    })
    fireEvent.change(screen.getByLabelText(/estimate/i), {
      target: { value: '45' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /task details/i }))

    await waitFor(() => {
      expect(create.mutate).toHaveBeenCalledTimes(1)
    })
    const payload = create.mutate.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      title: 'Draft proposal',
      priority: 'MEDIUM',
      estimatedMinutes: 45,
      dueDate: null,
    })
    expect(payload).not.toHaveProperty('status')
    expect(payload).not.toHaveProperty('effortVersion')

    const options = create.mutate.mock.calls[0]?.[1] as
      | { onSuccess?: () => void }
      | undefined
    options?.onSuccess?.()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('updates an existing task, carrying the effort version when work exists', async () => {
    const onOpenChange = vi.fn()
    renderSheet({ task: sampleTask, onOpenChange })

    expect(
      screen.getByRole('heading', { name: /edit task/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^Title/)).toHaveValue('Write report')

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Write final report' },
    })
    fireEvent.submit(screen.getByRole('form', { name: /task details/i }))

    await waitFor(() => {
      expect(update.mutate).toHaveBeenCalledTimes(1)
    })
    const call = update.mutate.mock.calls[0]?.[0] as {
      id: number
      request: Record<string, unknown>
    }
    expect(call.id).toBe(1)
    expect(call.request).toMatchObject({
      title: 'Write final report',
      status: 'OPEN',
      effortVersion: 0,
    })

    const options = update.mutate.mock.calls[0]?.[1] as
      | { onSuccess?: () => void }
      | undefined
    options?.onSuccess?.()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('keeps Open closed once work is recorded', () => {
    renderSheet({
      task: { ...sampleTask, status: 'IN_PROGRESS', effortVersion: 1 },
    })

    expect(screen.getByRole('option', { name: 'Open' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'In progress' })).toBeEnabled()
  })

  it('explains a progress conflict instead of closing', () => {
    vi.mocked(useUpdateTask).mockReturnValue(
      mutation({
        isError: true,
        error: new ApiError({
          status: 409,
          message: 'Conflict',
          code: 'PROGRESS_CONFLICT',
        }),
      }) as unknown as ReturnType<typeof useUpdateTask>,
    )

    renderSheet({ task: sampleTask })

    expect(screen.getByRole('alert')).toHaveTextContent(
      /a newer update was kept/i,
    )
  })

  it('uses the English date control and puts server errors on the field', () => {
    vi.mocked(useCreateTask).mockReturnValue(
      mutation({
        isError: true,
        error: new ApiError({
          status: 400,
          message: 'Validation failed',
          details: { dueDate: ['must be a valid date'] },
        }),
      }) as unknown as ReturnType<typeof useCreateTask>,
    )

    renderSheet()

    expect(document.querySelector('input[type="date"]')).toBeNull()
    const trigger = screen.getByLabelText(/due date/i)
    expect(trigger.tagName).toBe('BUTTON')
    expect(screen.getByText('must be a valid date')).toBeInTheDocument()
  })

  it('adds and removes blockers without offering the task itself', async () => {
    const blocker: TaskResponse = {
      ...sampleTask,
      id: 2,
      title: 'Collect data',
      status: 'IN_PROGRESS',
    }
    const candidate: TaskResponse = {
      ...sampleTask,
      id: 3,
      title: 'Publish',
      status: 'OPEN',
    }
    mockedUseTasks.mockReturnValue({
      tasks: [
        {
          ...sampleTask,
          blockedBy: [
            { taskId: 2, title: 'Collect data', status: 'IN_PROGRESS' },
          ],
        },
        blocker,
        candidate,
      ],
      isPending: false,
      isError: false,
      isEmpty: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useTasks>)
    renderSheet({
      task: {
        ...sampleTask,
        blockedBy: [{ taskId: 2, title: 'Collect data', status: 'IN_PROGRESS' }],
      },
    })

    const picker = screen.getByLabelText(/add blocker/i)
    const options = within(picker).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Add a blocker…', 'Publish'])

    fireEvent.change(picker, { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(addBlocker.mutate.mock.calls[0]?.[0]).toEqual({
      id: 1,
      blockerTaskId: 3,
    })

    fireEvent.click(
      screen.getByRole('button', { name: /remove collect data/i }),
    )
    expect(removeBlocker.mutate).toHaveBeenCalledWith({
      id: 1,
      blockerId: 2,
    })
  })

  it('explains a dependency cycle and keeps the sheet open', () => {
    vi.mocked(useAddBlocker).mockReturnValue(
      mutation({
        isError: true,
        error: new ApiError({
          status: 400,
          message: 'Dependency cycle',
          code: 'DEPENDENCY_CYCLE',
        }),
      }) as unknown as ReturnType<typeof useAddBlocker>,
    )

    renderSheet({ task: sampleTask })

    expect(screen.getByRole('alert')).toHaveTextContent(/cycle/i)
    expect(
      screen.getByRole('heading', { name: /edit task/i }),
    ).toBeInTheDocument()
  })

  it('asks before discarding a dirty sheet and closes a clean one at once', () => {
    const onOpenChange = vi.fn()
    renderSheet({ task: sampleTask, onOpenChange })

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    onOpenChange.mockClear()

    fireEvent.change(screen.getByLabelText(/^Title/), {
      target: { value: 'Changed title' },
    })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(onOpenChange).not.toHaveBeenCalled()
    const dialog = screen.getByRole('alertdialog', { name: /discard/i })
    expect(dialog).toHaveTextContent(/unsaved changes/i)

    fireEvent.click(within(dialog).getByRole('button', { name: /keep editing/i }))
    expect(onOpenChange).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    fireEvent.click(screen.getByRole('button', { name: /^discard$/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the remaining effort read-only with a Reassess control in edit mode', () => {
    renderSheet({ task: sampleTask })

    expect(screen.getByText('25m')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /reassess remaining effort for write report/i,
      }),
    ).toBeInTheDocument()
  })

  it('tells the user that a new task starts at its estimate', () => {
    renderSheet()

    expect(screen.getByText(/starts at the estimate/i)).toBeInTheDocument()
  })
})
