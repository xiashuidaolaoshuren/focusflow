import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CommitmentList } from '@/features/commitments/CommitmentList'

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

const mockedUseCommitments = vi.mocked(useCommitments)
const mockedUseCreateCommitment = vi.mocked(useCreateCommitment)
const mockedUseUpdateCommitment = vi.mocked(useUpdateCommitment)
const mockedUseDeleteCommitment = vi.mocked(useDeleteCommitment)

function renderCommitmentList(planDate = '2026-06-16') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <CommitmentList planDate={planDate} />
    </QueryClientProvider>,
  )
}

describe('CommitmentList', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loads commitments for the selected planning date', () => {
    mockedUseCommitments.mockReturnValue({
      commitments: [],
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCommitments>)
    mockedUseCreateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCreateCommitment>)
    mockedUseUpdateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useUpdateCommitment>)
    mockedUseDeleteCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useDeleteCommitment>)

    renderCommitmentList('2026-06-16')

    expect(mockedUseCommitments).toHaveBeenCalledWith('2026-06-16')
    expect(screen.getByText(/fixed-time blocks for 2026-06-16/i)).toBeInTheDocument()
  })

  it('creates a commitment for the selected date', () => {
    const mutate = vi.fn()
    mockedUseCommitments.mockReturnValue({
      commitments: [],
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCommitments>)
    mockedUseCreateCommitment.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCreateCommitment>)
    mockedUseUpdateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useUpdateCommitment>)
    mockedUseDeleteCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useDeleteCommitment>)

    renderCommitmentList('2026-06-16')

    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Standup' },
    })
    fireEvent.change(screen.getByLabelText(/^date$/i), {
      target: { value: '2026-06-16' },
    })
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: '09:00' },
    })
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '09:30' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add commitment/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        title: 'Standup',
        commitmentDate: '2026-06-16',
        startTime: '09:00:00',
        endTime: '09:30:00',
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('updates a commitment including a moved date', () => {
    const mutate = vi.fn()
    mockedUseCommitments.mockReturnValue({
      commitments: [
        {
          id: 1,
          title: 'Standup',
          commitmentDate: '2026-06-16',
          startTime: '09:00:00',
          endTime: '09:30:00',
        },
      ],
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCommitments>)
    mockedUseCreateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCreateCommitment>)
    mockedUseUpdateCommitment.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useUpdateCommitment>)
    mockedUseDeleteCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useDeleteCommitment>)

    renderCommitmentList('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    fireEvent.change(screen.getByLabelText(/^title$/i), {
      target: { value: 'Moved meeting' },
    })
    fireEvent.change(screen.getByLabelText(/^date$/i), {
      target: { value: '2026-06-17' },
    })
    fireEvent.change(screen.getByLabelText(/^start$/i), {
      target: { value: '14:00' },
    })
    fireEvent.change(screen.getByLabelText(/^end$/i), {
      target: { value: '15:00' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save commitment/i }))

    expect(mutate).toHaveBeenCalledWith(
      {
        id: 1,
        request: {
          title: 'Moved meeting',
          commitmentDate: '2026-06-17',
          startTime: '14:00:00',
          endTime: '15:00:00',
        },
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    )
  })

  it('deletes a commitment only after confirmation', async () => {
    const mutate = vi.fn()
    mockedUseCommitments.mockReturnValue({
      commitments: [
        {
          id: 1,
          title: 'Standup',
          commitmentDate: '2026-06-16',
          startTime: '09:00:00',
          endTime: '09:30:00',
        },
      ],
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCommitments>)
    mockedUseCreateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useCreateCommitment>)
    mockedUseUpdateCommitment.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useUpdateCommitment>)
    mockedUseDeleteCommitment.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as ReturnType<typeof useDeleteCommitment>)

    renderCommitmentList('2026-06-16')

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /delete commitment/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          onSuccess: expect.any(Function),
        }),
      )
    })
  })
})
