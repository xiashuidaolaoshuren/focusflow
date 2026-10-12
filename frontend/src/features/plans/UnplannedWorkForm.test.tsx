import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { UnplannedWorkForm } from '@/features/plans/UnplannedWorkForm'
import type { TaskResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    useCreateUnplannedWork: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  }
})

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
  getLocalTimeString: vi.fn(() => '09:45:00'),
}))

import { useCreateUnplannedWork } from '@/features/plans/hooks'

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
}

function renderForm() {
  render(<UnplannedWorkForm planDate="2026-06-15" tasks={[liveTask]} />)
}

async function selectTask() {
  fireEvent.click(screen.getByRole('combobox', { name: /task/i }))
  const option = await screen.findByRole('option', { name: /write tests/i })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function submitButton() {
  return screen.getByRole('button', { name: /log unplanned work/i })
}

describe('UnplannedWorkForm', () => {
  it('posts the entry with the task effort version and the client date', async () => {
    const mutate = vi.fn()
    mockedUseCreateUnplannedWork.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUnplannedWork>)

    renderForm()
    await selectTask()
    fireEvent.change(screen.getByLabelText(/work date/i), {
      target: { value: '2026-06-14' },
    })
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    fireEvent.click(submitButton())

    expect(mutate).toHaveBeenCalledWith(
      {
        taskId: 10,
        workDate: '2026-06-14',
        actualMinutes: 20,
        currentDate: '2026-06-15',
        effortVersion: 2,
        finish: false,
        checkpoint: null,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('defaults the work date to the plan date', async () => {
    mockedUseCreateUnplannedWork.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUnplannedWork>)

    renderForm()

    expect(screen.getByLabelText(/work date/i)).toHaveValue('2026-06-15')
  })

  it('blocks a save that would exhaust the remainder until Finish is chosen', async () => {
    mockedUseCreateUnplannedWork.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUnplannedWork>)

    renderForm()
    await selectTask()
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '30' },
    })

    expect(submitButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/finish task/i))
    expect(submitButton()).toBeEnabled()
  })

  it('rejects a work date after the client current date', async () => {
    mockedUseCreateUnplannedWork.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateUnplannedWork>)

    renderForm()
    await selectTask()
    fireEvent.change(screen.getByLabelText(/work date/i), {
      target: { value: '2026-06-16' },
    })
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '10' },
    })

    expect(submitButton()).toBeDisabled()
  })
})
