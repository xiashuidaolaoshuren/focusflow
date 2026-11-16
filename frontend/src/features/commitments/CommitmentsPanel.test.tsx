import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommitmentsPanel } from '@/features/commitments/CommitmentsPanel'
import { ApiError } from '@/lib/api'

vi.mock('@/features/commitments/hooks', () => ({
  useCommitments: vi.fn(),
  useCreateCommitment: vi.fn(),
  useUpdateCommitment: vi.fn(),
  useDeleteCommitment: vi.fn(),
}))

import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
} from '@/features/commitments/hooks'

vi.mock('@/features/preferences/hooks', () => ({
  useSchedulingPreferences: vi.fn(() => ({
    preferences: { workDayStart: '09:00:00', workDayEnd: '18:00:00' },
  })),
}))

const mockedUseCommitments = vi.mocked(useCommitments)
const mockedUseCreateCommitment = vi.mocked(useCreateCommitment)
const mockedUseUpdateCommitment = vi.mocked(useUpdateCommitment)
const mockedUseDeleteCommitment = vi.mocked(useDeleteCommitment)

function mockMutation(overrides: Record<string, unknown> = {}) {
  return {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    ...overrides,
  } as never
}

function mockCommitments(commitments: unknown[]) {
  mockedUseCommitments.mockReturnValue({
    commitments,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useCommitments>)
}

function renderPanel(planDate = '2026-06-16') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CommitmentsPanel planDate={planDate} />
    </QueryClientProvider>,
  )
}

describe('CommitmentsPanel', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('lists the day commitments with a count and their time ranges', () => {
    mockCommitments([
      {
        id: 1,
        title: 'Standup',
        commitmentDate: '2026-06-16',
        startTime: '09:00:00',
        endTime: '09:30:00',
      },
    ])
    mockedUseCreateCommitment.mockReturnValue(mockMutation())
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    expect(mockedUseCommitments).toHaveBeenCalledWith('2026-06-16')
    expect(screen.getByRole('heading', { name: 'Commitments' })).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('Standup')).toBeInTheDocument()
    expect(screen.getByText('09:00–09:30', { exact: false })).toBeInTheDocument()
    expect(screen.queryByText(/priority|status/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when the day has no commitments', () => {
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation())
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    expect(screen.getByText('No Commitments today')).toBeInTheDocument()
  })

  it('opens an inline add form with default times and closes it on cancel', () => {
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation())
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByLabelText(/^title/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^start$/i)).toHaveValue('15:00')
    expect(screen.getByLabelText(/^end$/i)).toHaveValue('15:30')

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument()
  })

  it('adds a commitment for the viewed date and closes the form on success', async () => {
    const mutate = vi.fn()
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation({ mutate }))
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Standup' },
    })
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: '09:00' },
    })
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '09:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        {
          title: 'Standup',
          commitmentDate: '2026-06-16',
          startTime: '09:00:00',
          endTime: '09:30:00',
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })

    const [, options] = mutate.mock.calls[0]!
    options.onSuccess()

    await waitFor(() => {
      expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument()
    })
  })

  it('blocks invalid input on the client with the schema message', async () => {
    const mutate = vi.fn()
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation({ mutate }))
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    expect(await screen.findByText('Title is required')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Standup' },
    })
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: '10:00' },
    })
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '09:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    expect(
      await screen.findByText('End time must be after start time'),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('uses 24-hour time fields that normalise typed times on blur', async () => {
    const mutate = vi.fn()
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation({ mutate }))
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    const { container } = renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(container.querySelector('input[type="time"]')).toBeNull()

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Review' },
    })
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: '930' },
    })
    fireEvent.blur(screen.getByLabelText(/^start$/i))
    expect(screen.getByLabelText(/^start$/i)).toHaveValue('09:30')

    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '1000' },
    })
    fireEvent.blur(screen.getByLabelText(/^end$/i))
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          startTime: '09:30:00',
          endTime: '10:00:00',
        }),
        expect.any(Object),
      )
    })
  })

  it('edits a commitment in place, keeping its own date, and closes on success', async () => {
    const mutate = vi.fn()
    mockCommitments([
      {
        id: 7,
        title: 'Standup',
        commitmentDate: '2026-06-16',
        startTime: '09:00:00',
        endTime: '09:30:00',
      },
    ])
    mockedUseCreateCommitment.mockReturnValue(mockMutation())
    mockedUseUpdateCommitment.mockReturnValue(mockMutation({ mutate }))
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: 'Edit Standup' }))

    expect(screen.getByLabelText(/^title/i)).toHaveValue('Standup')
    expect(screen.getByLabelText(/^start$/i)).toHaveValue('09:00')

    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: 'Moved standup' },
    })
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '09:45' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        {
          id: 7,
          request: {
            title: 'Moved standup',
            commitmentDate: '2026-06-16',
            startTime: '09:00:00',
            endTime: '09:45:00',
          },
        },
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })

    const [, options] = mutate.mock.calls[0]!
    options.onSuccess()

    await waitFor(() => {
      expect(screen.queryByLabelText(/^title/i)).not.toBeInTheDocument()
    })
  })

  it('deletes only after an inline confirmation and returns focus on cancel', async () => {
    const mutate = vi.fn()
    mockCommitments([
      {
        id: 1,
        title: 'Standup',
        commitmentDate: '2026-06-16',
        startTime: '09:00:00',
        endTime: '09:30:00',
      },
    ])
    mockedUseCreateCommitment.mockReturnValue(mockMutation())
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation({ mutate }))

    renderPanel('2026-06-16')

    const rowDelete = screen.getByRole('button', { name: 'Delete Standup' })
    fireEvent.click(rowDelete)

    expect(screen.getByText('Delete Standup?')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByText('Delete Standup?')).not.toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete Standup' })).toHaveFocus()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Standup' }))
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ onSuccess: expect.any(Function) }),
      )
    })
  })

  it('shows a server field error on the matching field and keeps the form open', () => {
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(
      mockMutation({ isError: true, error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: {
          title: ['Title must be at most 255 characters'],
          endTime: ['End time is outside the work window'],
        },
      }) }),
    )
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(
      screen.getByText('Title must be at most 255 characters'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('End time is outside the work window'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^title/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a form-level server message when the error has no field details', () => {
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(
      mockMutation({ isError: true, error: new ApiError({
        status: 400,
        message: 'Commitment overlaps Standup',
      }) }),
    )
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent('Commitment overlaps Standup')
    expect(screen.getByLabelText(/^title/i)).toBeInTheDocument()
  })

  it('explains an overlap in plain English', () => {
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(
      mockMutation({
        isError: true,
        error: new ApiError({
          status: 400,
          message: 'commitments must not overlap on the same date',
        }),
      }),
    )
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      'That time overlaps another commitment.',
    )
  })

  it('refuses a commitment outside the Work window before any request', async () => {
    const mutate = vi.fn()
    mockCommitments([])
    mockedUseCreateCommitment.mockReturnValue(mockMutation({ mutate }))
    mockedUseUpdateCommitment.mockReturnValue(mockMutation())
    mockedUseDeleteCommitment.mockReturnValue(mockMutation())

    renderPanel('2026-06-16')
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(screen.getByLabelText(/^title/i), { target: { value: 'Dentist' } })
    fireEvent.change(screen.getByLabelText(/^start$/i), { target: { value: '03:00' } })
    fireEvent.change(screen.getByLabelText(/^end$/i), { target: { value: '04:00' } })
    fireEvent.click(screen.getByRole('button', { name: /^save commitment$/i }))

    expect(
      await screen.findByText('Keep it inside the Work window (09:00–18:00).'),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })
})
