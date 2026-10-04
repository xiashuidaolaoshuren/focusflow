import { QueryClient, QueryClientProvider, useIsMutating } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TaskForm, TaskFormSubmitButton } from '@/features/tasks/TaskForm'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import { ApiError } from '@/lib/api'
import type { TaskResponse } from '@/types/api'
import type { UseUpdateTaskOptions } from '@/features/tasks/hooks'

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
    '@tanstack/react-query',
  )
  return {
    ...actual,
    useIsMutating: vi.fn(() => 0),
  }
})

vi.mock('@/features/tasks/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/tasks/hooks')>()
  return {
    ...actual,
    useCreateTask: vi.fn(),
    useUpdateTask: vi.fn(),
  }
})

import { useCreateTask, useUpdateTask } from '@/features/tasks/hooks'

const mockedUseCreateTask = vi.mocked(useCreateTask)
const mockedUseUpdateTask = vi.mocked(useUpdateTask)
const mockedUseIsMutating = vi.mocked(useIsMutating)

function renderTaskForm(
  onSuccess = vi.fn(),
  task?: TaskResponse,
  onEffortConflict = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <TaskForm
        onSuccess={onSuccess}
        onEffortConflict={onEffortConflict}
        task={task}
      />
      <TaskFormSubmitButton isEditMode={task != null} />
    </QueryClientProvider>,
  )

  return {
    ...view,
    onSuccess,
    rerenderForm: (
      nextOnSuccess = onSuccess,
      nextTask = task,
      nextOnEffortConflict = onEffortConflict,
    ) =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <TaskForm
            onSuccess={nextOnSuccess}
            onEffortConflict={nextOnEffortConflict}
            task={nextTask}
          />
          <TaskFormSubmitButton isEditMode={nextTask != null} />
        </QueryClientProvider>,
      ),
  }
}

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
}

describe('TaskForm', () => {
  it('renders fields, submits create payload, and disables submit while pending', async () => {
    const mutate = vi.fn()
    mockedUseCreateTask.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateTask>)
    mockedUseIsMutating.mockReturnValue(0)

    const { rerenderForm } = renderTaskForm()

    expect(screen.getByLabelText(/^title$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: /priority/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/due date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estimated minutes/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create task/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Write tests' },
    })
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'TDD coverage' },
    })
    fireEvent.click(screen.getByRole('combobox', { name: /priority/i }))
    const highOption = await screen.findByRole('option', { name: /^high$/i })
    fireEvent.pointerDown(highOption)
    fireEvent.click(highOption)
    fireEvent.change(screen.getByLabelText(/due date/i), {
      target: { value: '2026-06-01' },
    })
    fireEvent.change(screen.getByLabelText(/estimated minutes/i), {
      target: { value: '45' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create task/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        title: 'Write tests',
        description: 'TDD coverage',
        priority: 'HIGH',
        dueDate: '2026-06-01',
        estimatedMinutes: 45,
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )

    mockedUseIsMutating.mockImplementation((filters) => {
      const mutationKey = filters?.mutationKey
      return Array.isArray(mutationKey) && mutationKey[1] === 'create' ? 1 : 0
    })

    rerenderForm()

    expect(screen.getByRole('button', { name: /create task/i })).toBeDisabled()
  })

  it('shows inline field errors from ApiError details', () => {
    mockedUseCreateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: { title: ['must not be blank'] },
      }),
    } as unknown as ReturnType<typeof useCreateTask>)

    renderTaskForm()

    expect(screen.getByText('must not be blank')).toBeInTheDocument()
  })

  it('links field errors via aria-describedby', () => {
    mockedUseCreateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: {
          title: ['must not be blank'],
          description: ['must not exceed 500 characters'],
          dueDate: ['must be a valid date'],
          estimatedMinutes: ['must be positive'],
        },
      }),
    } as unknown as ReturnType<typeof useCreateTask>)

    renderTaskForm()

    expect(screen.getByLabelText(/^title$/i)).toHaveAttribute(
      'aria-describedby',
      'title-error',
    )
    expect(screen.getByText('must not be blank')).toHaveAttribute(
      'id',
      'title-error',
    )
    expect(screen.getByLabelText(/description/i)).toHaveAttribute(
      'aria-describedby',
      'description-error',
    )
    expect(screen.getByText('must not exceed 500 characters')).toHaveAttribute(
      'id',
      'description-error',
    )
    expect(screen.getByLabelText(/due date/i)).toHaveAttribute(
      'aria-describedby',
      'dueDate-error',
    )
    expect(screen.getByText('must be a valid date')).toHaveAttribute(
      'id',
      'dueDate-error',
    )
    expect(screen.getByLabelText(/estimated minutes/i)).toHaveAttribute(
      'aria-describedby',
      'estimatedMinutes-error',
    )
    expect(screen.getByText('must be positive')).toHaveAttribute(
      'id',
      'estimatedMinutes-error',
    )
  })

  it('shows a top-level alert for non-field errors', () => {
    mockedUseCreateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 500,
        message: 'Unexpected error',
      }),
    } as unknown as ReturnType<typeof useCreateTask>)

    renderTaskForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Unexpected error')
  })

  it('shows read-only remaining effort separately from the estimate in edit mode', () => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(vi.fn(), sampleTask)

    expect(screen.getByText('25 min remaining')).toBeInTheDocument()
    expect(screen.queryByLabelText(/remaining effort/i)).not.toBeInTheDocument()
  })

  it('shows unknown remaining effort as Unknown in edit mode', () => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(vi.fn(), { ...sampleTask, remainingEffortMinutes: null })

    expect(screen.getByText('Unknown remaining')).toBeInTheDocument()
  })

  it('shows estimate lock copy and sends effortVersion after visible progress', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(
      vi.fn(),
      { ...sampleTask, status: 'IN_PROGRESS', effortVersion: 2 },
    )

    expect(
      screen.getByText(/editing the estimate does not change remaining effort/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/estimated minutes/i), {
      target: { value: '90' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save task/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 1,
        request: expect.objectContaining({
          estimatedMinutes: 90,
          effortVersion: 2,
        }),
      },
      expect.any(Object),
    )
    expect(mutate.mock.calls[0]?.[0].request).not.toHaveProperty(
      'remainingEffortMinutes',
    )
  })

  it('shows estimate lock copy when remaining effort differs from the estimate on an open task', () => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(
      vi.fn(),
      { ...sampleTask, status: 'OPEN', remainingEffortMinutes: 40 },
    )

    expect(
      screen.getByText(/editing the estimate does not change remaining effort/i),
    ).toBeInTheDocument()
  })

  it('shows conflict explanation and notifies parent on PROGRESS_CONFLICT', () => {
    const onEffortConflict = vi.fn()
    let hookOptions: UseUpdateTaskOptions | undefined
    mockedUseUpdateTask.mockImplementation((options) => {
      hookOptions = options
      return {
        mutate: vi.fn(),
        isPending: false,
        isError: false,
        error: null,
      } as unknown as ReturnType<typeof useUpdateTask>
    })

    renderTaskForm(vi.fn(), sampleTask, onEffortConflict)

    act(() => {
      hookOptions?.onEffortConflict?.()
    })

    expect(screen.getByText(PROGRESS_CONFLICT_MESSAGE)).toBeInTheDocument()
    expect(onEffortConflict).toHaveBeenCalled()
  })

  it('limits edit form status options to Open and In progress', async () => {
    mockedUseUpdateTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(vi.fn(), sampleTask)

    fireEvent.click(screen.getByRole('combobox', { name: /status/i }))
    expect(await screen.findByRole('option', { name: /^open$/i })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /in progress/i })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^done$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /^cancelled$/i })).not.toBeInTheDocument()
  })

  it('prefills fields in edit mode and submits update mutation with task id', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)

    renderTaskForm(vi.fn(), sampleTask)

    expect(screen.getByLabelText(/^title$/i)).toHaveValue('Write report')
    expect(screen.getByLabelText(/description/i)).toHaveValue('Quarterly summary')
    expect(screen.getByRole('combobox', { name: /priority/i })).toHaveTextContent(
      /high/i,
    )
    expect(screen.getByLabelText(/due date/i)).toHaveValue('2026-06-15')
    expect(screen.getByLabelText(/estimated minutes/i)).toHaveValue(60)
    expect(screen.getByRole('combobox', { name: /status/i })).toHaveTextContent(
      /open/i,
    )
    expect(
      screen.getByRole('button', { name: /save task/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Updated report' },
    })
    fireEvent.click(screen.getByRole('combobox', { name: /status/i }))
    const inProgressOption = await screen.findByRole('option', { name: /in progress/i })
    fireEvent.pointerDown(inProgressOption)
    fireEvent.click(inProgressOption)
    fireEvent.click(screen.getByRole('button', { name: /save task/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 1,
        request: {
          title: 'Updated report',
          description: 'Quarterly summary',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          dueDate: '2026-06-15',
          estimatedMinutes: 60,
          effortVersion: 0,
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('disables save while form update mutation is pending', async () => {
    const mutate = vi.fn()
    mockedUseUpdateTask.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useUpdateTask>)
    mockedUseIsMutating.mockReturnValue(0)

    const { rerenderForm } = renderTaskForm(vi.fn(), sampleTask)

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Updated report' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save task/i }))

    expect(mutate).toHaveBeenCalled()

    mockedUseIsMutating.mockImplementation((filters) => {
      const mutationKey = filters?.mutationKey
      return Array.isArray(mutationKey) && mutationKey[1] === 'form-update' ? 1 : 0
    })

    rerenderForm(vi.fn(), sampleTask)

    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled()
  })
})
