import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import type { TaskResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    useCreateUnplannedWork: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  }
})

vi.mock('@/lib/planningDate', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/planningDate')>()
  return { ...actual, getLocalDateString: vi.fn(() => '2026-06-15') }
})

import { useCreateUnplannedWork } from '@/features/plans/hooks'
import { UnplannedWorkDialog } from '@/features/plans/UnplannedWorkDialog'

const mockedUseCreateUnplannedWork = vi.mocked(useCreateUnplannedWork)

const liveTask: TaskResponse = {
  id: 10,
  title: 'Write tests',
  description: null,
  priority: 'HIGH',
  status: 'IN_PROGRESS',
  dueDate: '2026-06-15',
  estimatedMinutes: 60,
  remainingEffortMinutes: 25,
  effortVersion: 2,
  blockedBy: [],
  blocks: [],
}

function mockMutation(mutate = vi.fn()) {
  mockedUseCreateUnplannedWork.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateUnplannedWork>)
  return mutate
}

function renderDialog(onClose = vi.fn()) {
  render(
    <UnplannedWorkDialog planDate="2026-06-15" tasks={[liveTask]} onClose={onClose} />,
  )
  return onClose
}

async function chooseTask() {
  fireEvent.click(screen.getByRole('combobox', { name: 'Task' }))
  const option = await screen.findByRole('option', { name: 'Write tests' })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function submitButton() {
  return screen.getByRole('button', { name: 'Log unplanned work' })
}

describe('UnplannedWorkDialog', () => {
  it('keeps Log unplanned work disabled until a task and minutes are entered', async () => {
    mockMutation()
    renderDialog()

    expect(submitButton()).toBeDisabled()

    await chooseTask()
    expect(submitButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Actual minutes'), {
      target: { value: '20' },
    })
    expect(submitButton()).toBeEnabled()
  })

  it('posts the entry with the task effort version and the client date', async () => {
    const mutate = mockMutation()
    renderDialog()

    await chooseTask()
    fireEvent.change(screen.getByLabelText('Actual minutes'), {
      target: { value: '20' },
    })
    fireEvent.click(submitButton())

    expect(mutate).toHaveBeenCalledWith(
      {
        taskId: 10,
        workDate: '2026-06-15',
        actualMinutes: 20,
        currentDate: '2026-06-15',
        effortVersion: 2,
        finish: false,
        checkpoint: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('shows a conflict message when the server reports a stale version', async () => {
    const mutate = mockMutation()
    renderDialog()

    await chooseTask()
    fireEvent.change(screen.getByLabelText('Actual minutes'), {
      target: { value: '5' },
    })
    fireEvent.click(submitButton())

    const options = mutate.mock.calls[0]?.[1] as { onError: (error: unknown) => void }
    options.onError(
      new ApiError({
        status: 409,
        message: 'stale',
        code: 'PROGRESS_CONFLICT',
      } as never),
    )

    expect(await screen.findByText(/changed elsewhere/i)).toBeInTheDocument()
  })
})
