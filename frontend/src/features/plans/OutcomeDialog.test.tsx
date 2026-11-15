import { act, render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { describe, expect, it, vi } from 'vitest'

import { samplePlan, sampleWorkBlock } from '@/features/plans/planFixtures'
import type { TaskResponse, WorkBlockResponse } from '@/types/api'

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
import { OutcomeDialog } from '@/features/plans/OutcomeDialog'

const mockedUseRecordBlockProgress = vi.mocked(useRecordBlockProgress)

vi.mock('@/lib/planningDate', () => ({
  getLocalDateString: vi.fn(() => '2026-06-15'),
  getLocalTimeString: vi.fn(() => '09:45:00'),
  getLocalMinuteString: vi.fn(() => '09:45:00'),
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
  blockedBy: [],
  blocks: [],
}

function mockMutation(mutate = vi.fn()) {
  mockedUseRecordBlockProgress.mockReturnValue({
    mutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRecordBlockProgress>)
  return mutate
}

function renderDialog(
  overrides: Partial<{
    block: WorkBlockResponse
    task: TaskResponse | null
    now: string | null
  }> = {},
) {
  const onClose = vi.fn()

  render(
    <OutcomeDialog
      plan={samplePlan}
      block={overrides.block ?? sampleWorkBlock}
      task={overrides.task === undefined ? liveTask : overrides.task}
      now={overrides.now === undefined ? '09:45:00' : overrides.now}
      onClose={onClose}
    />,
  )

  return { onClose }
}

function saveButton() {
  return screen.getByRole('button', { name: /save outcome/i })
}

describe('OutcomeDialog existing outcome', () => {
  it('opens with the recorded outcome selected and its actual minutes', () => {
    mockMutation()
    renderDialog({
      block: { ...sampleWorkBlock, outcome: 'PARTLY_DONE', actualMinutes: 30 },
    })

    expect(screen.getByRole('radio', { name: /^partly done$/i })).toBeChecked()
    expect(screen.getByLabelText(/actual minutes/i)).toHaveValue(30)
    expect(screen.getByLabelText(/actual minutes/i)).toBeEnabled()
  })
})

describe('OutcomeDialog reconcile', () => {
  const crossingBlock = { ...sampleWorkBlock, endTime: '10:30:00' }

  it('opens in reconcile mode for a block spanning the current time', () => {
    mockMutation()
    renderDialog({ block: crossingBlock })

    expect(
      screen.getByRole('heading', { name: /reconcile elapsed portion/i }),
    ).toBeInTheDocument()
  })

  it('does not reconcile a past or future day, which has no current minute', () => {
    mockMutation()
    renderDialog({ block: crossingBlock, now: null })

    expect(
      screen.queryByRole('heading', { name: /reconcile elapsed portion/i }),
    ).toBeNull()
    expect(
      screen.getByRole('heading', { name: /record outcome/i }),
    ).toBeInTheDocument()
  })

  it('shows actual minutes for a skipped reconcile session', () => {
    mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^skipped$/i }))

    expect(screen.getByLabelText(/actual minutes/i)).toBeInTheDocument()
  })

  it('offers Finish task while reconciling a running session', () => {
    mockMutation()
    renderDialog({ block: crossingBlock })

    expect(screen.getByLabelText(/finish task/i)).toBeInTheDocument()
  })

  it('prefills the reassess box with the computed remainder', () => {
    mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })

    expect(
      screen.queryByLabelText(/remaining effort minutes/i),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /reassess remaining effort/i }),
    )
    expect(screen.getByLabelText(/remaining effort minutes/i)).toHaveValue(5)
  })

  it('lets an explicit remainder override the computed one', () => {
    const mutate = mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /reassess remaining effort/i }),
    )
    fireEvent.change(screen.getByLabelText(/remaining effort minutes/i), {
      target: { value: '12' },
    })
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          checkpoint: { remainingEffortMinutes: 12 },
        }),
      }),
      expect.anything(),
    )
  })

  it('sends an unknown remainder as a null checkpoint', () => {
    const mutate = mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /reassess remaining effort/i }),
    )
    fireEvent.click(screen.getByLabelText(/remaining effort is unknown/i))
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          checkpoint: { remainingEffortMinutes: null },
        }),
      }),
      expect.anything(),
    )
  })

  it('finishes the task from reconcile without a checkpoint', () => {
    const mutate = mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    fireEvent.click(screen.getByLabelText(/finish task/i))
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          outcome: 'PARTLY_DONE',
          actualMinutes: 20,
          finish: true,
          checkpoint: null,
        }),
      }),
      expect.anything(),
    )
  })

  it('saves once the actual minutes are known, defaulting the checkpoint', () => {
    const mutate = mockMutation()
    renderDialog({ block: crossingBlock })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })

    expect(saveButton()).toBeEnabled()
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          outcome: 'PARTLY_DONE',
          actualMinutes: 20,
          cutoff: '09:45:00',
          checkpoint: { remainingEffortMinutes: 5 },
        }),
      }),
      expect.anything(),
    )
  })

  it('sends a minute-aligned cutoff even when the clock has seconds', () => {
    const mutate = mockMutation()
    renderDialog({ block: crossingBlock, now: '09:45:42' })

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ cutoff: '09:45:00' }),
      }),
      expect.anything(),
    )
  })
})

describe('OutcomeDialog summary', () => {
  it('shows planned, recorded, and the live remaining effort', () => {
    mockMutation()
    renderDialog()

    expect(screen.getByText('Planned')).toBeInTheDocument()
    expect(screen.getByText('45m')).toBeInTheDocument()
    expect(screen.getByText('Recorded')).toBeInTheDocument()
    expect(screen.getByText('Remaining effort')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })

    expect(screen.getByText('20m')).toBeInTheDocument()
    expect(screen.getByText('5m')).toBeInTheDocument()
  })

  it('labels the first stat Elapsed and counts to the current minute when reconciling', () => {
    mockMutation()
    renderDialog({ block: { ...sampleWorkBlock, endTime: '10:30:00' } })

    expect(screen.getByText('Elapsed')).toBeInTheDocument()
    expect(screen.getByText('45m')).toBeInTheDocument()
  })
})

describe('OutcomeDialog conflict', () => {
  it('shows the plan-changed alert and does not close as a success', () => {
    mockMutation()
    const { onClose } = renderDialog()

    const options = mockedUseRecordBlockProgress.mock.calls.at(-1)?.[0]
    expect(options?.onConflict).toBeTypeOf('function')
    act(() => options!.onConflict!())

    expect(screen.getByRole('alert')).toHaveTextContent(/plan changed elsewhere/i)
    expect(screen.getByText(/latest daily plan/i)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('OutcomeDialog exhaustion gate', () => {
  it('blocks a done save that would exhaust the live remainder until Finish is chosen', () => {
    const mutate = mockMutation()
    renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: /^done$/i }))
    expect(saveButton()).toBeDisabled()

    fireEvent.click(screen.getByLabelText(/finish task/i))
    expect(saveButton()).toBeEnabled()

    fireEvent.click(saveButton())
    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ outcome: 'DONE', finish: true }),
      }),
      expect.anything(),
    )
  })

  it('unblocks when a positive remaining-effort checkpoint is entered', () => {
    mockMutation()
    renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: /^done$/i }))
    expect(saveButton()).toBeDisabled()

    fireEvent.click(
      screen.getByRole('button', { name: /reassess remaining effort/i }),
    )
    fireEvent.change(screen.getByLabelText(/remaining effort minutes/i), {
      target: { value: '10' },
    })

    expect(saveButton()).toBeEnabled()
  })

  it('does not gate an unknown remainder', () => {
    mockMutation()
    renderDialog({ task: { ...liveTask, remainingEffortMinutes: null } })

    fireEvent.click(screen.getByRole('radio', { name: /^done$/i }))

    expect(saveButton()).toBeEnabled()
  })

  it('does not gate a correction of an existing outcome', () => {
    mockMutation()
    renderDialog({
      block: {
        ...sampleWorkBlock,
        outcome: 'DONE',
        actualMinutes: 35,
        progressVersion: 1,
      },
    })

    expect(saveButton()).toBeEnabled()
  })
})

describe('OutcomeDialog save', () => {
  it('posts the outcome, actuals, version, and flags with the client date', () => {
    const mutate = mockMutation()
    const { onClose } = renderDialog({
      task: { ...liveTask, remainingEffortMinutes: 120 },
    })

    fireEvent.click(screen.getByRole('radio', { name: /^done$/i }))
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
          finish: false,
          checkpoint: null,
          cutoff: null,
        },
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
    expect(onClose).not.toHaveBeenCalled()

    const options = mutate.mock.calls[0]![1] as { onSuccess: () => void }
    options.onSuccess()
    expect(onClose).toHaveBeenCalled()
  })

  it('records no actual minutes for a skipped session', () => {
    const mutate = mockMutation()
    renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: /^skipped$/i }))
    fireEvent.click(saveButton())

    expect(mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({
          outcome: 'SKIPPED',
          actualMinutes: null,
        }),
      }),
      expect.anything(),
    )
  })
})

describe('OutcomeDialog skipped', () => {
  it('hides actual minutes for a skipped session in record mode', () => {
    mockMutation()
    renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: /^skipped$/i }))

    expect(
      screen.queryByLabelText(/actual minutes/i),
    ).not.toBeInTheDocument()
    expect(saveButton()).toBeEnabled()
  })
})

describe('OutcomeDialog validation', () => {
  it('enables Save for Done without actual minutes', () => {
    mockMutation()
    renderDialog({ task: { ...liveTask, remainingEffortMinutes: 120 } })

    fireEvent.click(screen.getByRole('radio', { name: /^done$/i }))

    expect(saveButton()).toBeEnabled()
  })

  it('requires a positive actual for Partly done and explains why', () => {
    mockMutation()
    renderDialog()

    fireEvent.click(screen.getByRole('radio', { name: /^partly done$/i }))
    expect(saveButton()).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '0' },
    })
    expect(saveButton()).toBeDisabled()
    expect(
      screen.getByText(/enter actual minutes for a partly done session/i),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/actual minutes/i), {
      target: { value: '20' },
    })
    expect(saveButton()).toBeEnabled()
    expect(
      screen.queryByText(/enter actual minutes for a partly done session/i),
    ).not.toBeInTheDocument()
  })
})

describe('OutcomeDialog fresh block', () => {
  it('opens with no outcome selected, disabled minutes, and Save disabled', () => {
    mockMutation()
    renderDialog()

    expect(screen.getByRole('radio', { name: /^done$/i })).not.toBeChecked()
    expect(
      screen.getByRole('radio', { name: /^partly done$/i }),
    ).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /^skipped$/i })).not.toBeChecked()
    expect(screen.getByLabelText(/actual minutes/i)).toBeDisabled()
    expect(saveButton()).toBeDisabled()
  })
})
