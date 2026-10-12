import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { BlockProgressDialog } from '@/features/plans/BlockProgressDialog'
import { samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { TaskResponse } from '@/types/api'

vi.mock('@/features/plans/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/hooks')>()
  return {
    ...actual,
    useRecordBlockProgress: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
  }
})

import { useRecordBlockProgress } from '@/features/plans/hooks'

const mockedUseRecordBlockProgress = vi.mocked(useRecordBlockProgress)

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
  getLocalTimeString: vi.fn(() => '09:45:00'),
}))

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

function renderDialog(
  overrides: Partial<{
    block: typeof sampleWorkBlock
    task: TaskResponse | null
  }> = {},
) {
  const onClose = vi.fn()
  const onConflict = vi.fn()

  render(
    <BlockProgressDialog
      plan={samplePlan}
      block={overrides.block ?? sampleWorkBlock}
      task={overrides.task === undefined ? liveTask : overrides.task}
      onClose={onClose}
      onConflict={onConflict}
    />,
  )

  return { onClose, onConflict }
}

async function selectOutcome(name: RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: /outcome/i }))
  const option = await screen.findByRole('option', { name })
  fireEvent.pointerDown(option)
  fireEvent.click(option)
}

function saveButton() {
  return screen.getByRole('button', { name: /save outcome/i })
}

describe('BlockProgressDialog save', () => {
  it('posts the outcome, actuals, version, and finish flag with the client date', async () => {
    const mutate = vi.fn()
    mockedUseRecordBlockProgress.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useRecordBlockProgress>)

    renderDialog()
    await selectOutcome(/^done$/i)
    fireEvent.click(screen.getByLabelText(/finish task/i))
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      {
        planId: 1,
        blockId: 100,
        request: {
          outcome: 'DONE',
          actualMinutes: null,
          currentDate: '2026-06-15',
          expectedProgressVersion: 0,
          finish: true,
          checkpoint: null,
          cutoff: null,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('records no actual minutes for an ordinary skipped session', async () => {
    const mutate = vi.fn()
    mockedUseRecordBlockProgress.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useRecordBlockProgress>)

    renderDialog()
    fireEvent.change(screen.getByLabelText(/^actual minutes$/i), {
      target: { value: '25' },
    })
    await selectOutcome(/^skipped$/i)

    expect(screen.queryByLabelText(/^actual minutes$/i)).not.toBeInTheDocument()

    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      {
        planId: 1,
        blockId: 100,
        request: expect.objectContaining({
          outcome: 'SKIPPED',
          actualMinutes: null,
        }),
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('posts the cutoff and the explicit remainder when reconciling an elapsed session', async () => {
    const mutate = vi.fn()
    mockedUseRecordBlockProgress.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useRecordBlockProgress>)

    renderDialog({ block: { ...sampleWorkBlock, endTime: '10:30:00' } })
    fireEvent.click(screen.getByLabelText(/reconcile the elapsed portion/i))
    await selectOutcome(/^partly done$/i)
    fireEvent.change(screen.getByLabelText(/^actual minutes$/i), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByLabelText(/remaining effort is unknown/i))
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      {
        planId: 1,
        blockId: 100,
        request: {
          outcome: 'PARTLY_DONE',
          actualMinutes: 20,
          currentDate: '2026-06-15',
          expectedProgressVersion: 0,
          finish: false,
          checkpoint: { remainingEffortMinutes: null },
          cutoff: '09:45:00',
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })
})

describe('BlockProgressDialog crossing reconciliation', () => {
  it('offers reconciliation for an actionable block spanning the current time', () => {
    renderDialog({
      block: { ...sampleWorkBlock, endTime: '10:30:00' },
    })

    expect(
      screen.getByLabelText(/reconcile the elapsed portion/i),
    ).toBeInTheDocument()
  })

  it('does not offer reconciliation for an ended or later-revision block', () => {
    renderDialog({ block: { ...sampleWorkBlock, endTime: '09:45:00' } })
    expect(
      screen.queryByLabelText(/reconcile the elapsed portion/i),
    ).not.toBeInTheDocument()
  })

  it('requires known actual minutes and an explicit remainder in reconcile mode', async () => {
    renderDialog({ block: { ...sampleWorkBlock, endTime: '10:30:00' } })

    fireEvent.click(screen.getByLabelText(/reconcile the elapsed portion/i))
    await selectOutcome(/^partly done$/i)

    expect(saveButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^actual minutes$/i), {
      target: { value: '20' },
    })
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/remaining effort is unknown/i))
    expect(saveButton()).toBeEnabled()
  })
})

describe('BlockProgressDialog exhaustion gate', () => {
  it('blocks a done save that would exhaust the live remainder until Finish is chosen', async () => {
    renderDialog()

    await selectOutcome(/^done$/i)

    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/finish task/i))
    expect(saveButton()).toBeEnabled()
  })

  it('unblocks when a positive remaining-effort checkpoint is entered', async () => {
    renderDialog()

    await selectOutcome(/^done$/i)
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/reassess remaining effort/i))
    fireEvent.change(screen.getByLabelText(/remaining effort minutes/i), {
      target: { value: '10' },
    })

    expect(saveButton()).toBeEnabled()
  })

  it('does not gate an unknown remainder', async () => {
    renderDialog({ task: { ...liveTask, remainingEffortMinutes: null } })

    await selectOutcome(/^done$/i)

    expect(saveButton()).toBeEnabled()
  })

  it('does not gate a skipped outcome that credits nothing', async () => {
    renderDialog()

    await selectOutcome(/^skipped$/i)

    expect(saveButton()).toBeEnabled()
  })
})

describe('BlockProgressDialog part-done validation', () => {
  it('requires positive actual minutes before a partly done save is available', async () => {
    renderDialog()

    await selectOutcome(/^partly done$/i)

    expect(saveButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '0' },
    })
    expect(saveButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    expect(saveButton()).toBeEnabled()
  })
})

describe('BlockProgressDialog summary', () => {
  it('shows planned duration, known actuals, and the live remaining effort', () => {
    renderDialog({
      block: { ...sampleWorkBlock, outcome: 'DONE', actualMinutes: 35 },
    })

    expect(screen.getByText(/45 min planned/i)).toBeInTheDocument()
    expect(screen.getByText(/35 min actual/i)).toBeInTheDocument()
    expect(screen.getByText(/25 min remaining/i)).toBeInTheDocument()
  })

  it('shows an unrecorded actual and unknown remainder without inventing a zero', () => {
    renderDialog({
      block: { ...sampleWorkBlock, outcome: null, actualMinutes: null },
      task: { ...liveTask, remainingEffortMinutes: null },
    })

    expect(screen.getByText(/not recorded/i)).toBeInTheDocument()
    expect(screen.getByText(/unknown remaining/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 min/i)).not.toBeInTheDocument()
  })

  it('falls back to the captured remaining effort when the live task is gone', () => {
    renderDialog({ task: null })

    expect(screen.getByText(/45 min captured remaining/i)).toBeInTheDocument()
  })
})
