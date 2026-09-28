import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SchedulingPreferencesForm } from '@/features/preferences/SchedulingPreferencesForm'
import { ApiError } from '@/lib/api'
import type { SchedulingPreferencesResponse } from '@/types/api'

vi.mock('@/features/preferences/hooks', () => ({
  useSchedulingPreferences: vi.fn(),
  useUpdateSchedulingPreferences: vi.fn(),
}))

import {
  useSchedulingPreferences,
  useUpdateSchedulingPreferences,
} from '@/features/preferences/hooks'

const mockedUseSchedulingPreferences = vi.mocked(useSchedulingPreferences)
const mockedUseUpdateSchedulingPreferences = vi.mocked(
  useUpdateSchedulingPreferences,
)

const defaultPreferences: SchedulingPreferencesResponse = {
  workDayStart: '09:00:00',
  workDayEnd: '18:00:00',
  cadenceEnabled: true,
  targetFocusMinutes: 50,
  breakMinutes: 10,
  minSessionMinutes: 15,
  bufferMinutes: 0,
  peakStart: null,
  peakEnd: null,
  fixedBreaks: [],
  persisted: false,
}

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <SchedulingPreferencesForm />
    </QueryClientProvider>,
  )
}

function mockLoadedPreferences(
  preferences: SchedulingPreferencesResponse = defaultPreferences,
) {
  mockedUseSchedulingPreferences.mockReturnValue({
    preferences,
    isPending: false,
    isError: false,
    error: null,
  } as ReturnType<typeof useSchedulingPreferences>)
}

function mockSaveMutation(
  mutate = vi.fn(),
  options: {
    isPending?: boolean
    isError?: boolean
    error?: Error | null
  } = {},
) {
  mockedUseUpdateSchedulingPreferences.mockReturnValue({
    mutate,
    isPending: options.isPending ?? false,
    isError: options.isError ?? false,
    error: options.error ?? null,
  } as ReturnType<typeof useUpdateSchedulingPreferences>)
}

describe('SchedulingPreferencesForm loading', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows unsaved-defaults copy only when persisted is false', () => {
    mockLoadedPreferences({ ...defaultPreferences, persisted: false })
    mockSaveMutation()

    renderForm()

    expect(
      screen.getByText(/apply until you save/i),
    ).toBeInTheDocument()
  })

  it('hides unsaved-defaults copy when preferences are persisted', () => {
    mockLoadedPreferences({ ...defaultPreferences, persisted: true })
    mockSaveMutation()

    renderForm()

    expect(
      screen.queryByText(/apply until you save/i),
    ).not.toBeInTheDocument()
  })

  it('binds effective values from GET into the form fields', () => {
    mockLoadedPreferences({
      ...defaultPreferences,
      workDayStart: '08:30:00',
      workDayEnd: '17:30:00',
      targetFocusMinutes: 55,
      breakMinutes: 12,
      minSessionMinutes: 20,
      bufferMinutes: 5,
      persisted: true,
    })
    mockSaveMutation()

    renderForm()

    expect(screen.getByLabelText(/work day start/i)).toHaveValue('08:30')
    expect(screen.getByLabelText(/work day end/i)).toHaveValue('17:30')
    expect(screen.getByLabelText(/target focus/i)).toHaveValue(55)
    expect(screen.getByLabelText(/break minutes/i)).toHaveValue(12)
    expect(screen.getByLabelText(/minimum session/i)).toHaveValue(20)
    expect(screen.getByLabelText(/trailing buffer/i)).toHaveValue(5)
  })
})

describe('SchedulingPreferencesForm save', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('PUTs the full aggregate including added and removed fixed breaks', async () => {
    const mutate = vi.fn()
    mockLoadedPreferences({
      ...defaultPreferences,
      workDayStart: '09:00:00',
      workDayEnd: '18:00:00',
      peakStart: '10:00:00',
      peakEnd: '12:00:00',
      fixedBreaks: [
        {
          label: 'Lunch',
          startTime: '12:00:00',
          endTime: '13:00:00',
        },
        {
          label: 'Old break',
          startTime: '15:00:00',
          endTime: '15:30:00',
        },
      ],
      persisted: true,
    })
    mockSaveMutation(mutate)

    renderForm()

    fireEvent.change(screen.getByLabelText(/work day start/i), {
      target: { value: '08:00' },
    })
    fireEvent.change(screen.getByLabelText(/work day end/i), {
      target: { value: '17:00' },
    })
    fireEvent.change(screen.getByLabelText(/target focus/i), {
      target: { value: '45' },
    })
    fireEvent.change(screen.getByLabelText(/break minutes/i), {
      target: { value: '8' },
    })
    fireEvent.change(screen.getByLabelText(/minimum session/i), {
      target: { value: '20' },
    })
    fireEvent.change(screen.getByLabelText(/trailing buffer/i), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText(/^peak start$/i), {
      target: { value: '' },
    })
    fireEvent.change(screen.getByLabelText(/^peak end$/i), {
      target: { value: '' },
    })

    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    fireEvent.click(removeButtons[removeButtons.length - 1]!)
    fireEvent.click(screen.getByRole('button', { name: /add break/i }))

    const breakRows = screen.getAllByLabelText(/^label$/i)
    const latestBreakLabel = breakRows[breakRows.length - 1]
    fireEvent.change(latestBreakLabel, { target: { value: 'Tea' } })

    const startInputs = screen.getAllByLabelText(/^start$/i)
    fireEvent.change(startInputs[startInputs.length - 1], {
      target: { value: '16:00' },
    })

    const endInputs = screen.getAllByLabelText(/^end$/i)
    fireEvent.change(endInputs[endInputs.length - 1], {
      target: { value: '16:15' },
    })

    fireEvent.click(screen.getByRole('button', { name: /save preferences/i }))

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1)
    })

    expect(mutate).toHaveBeenCalledWith({
      workDayStart: '08:00:00',
      workDayEnd: '17:00:00',
      cadenceEnabled: true,
      targetFocusMinutes: 45,
      breakMinutes: 8,
      minSessionMinutes: 20,
      bufferMinutes: 10,
      peakStart: null,
      peakEnd: null,
      fixedBreaks: [
        {
          label: 'Lunch',
          startTime: '12:00:00',
          endTime: '13:00:00',
        },
        {
          label: 'Tea',
          startTime: '16:00:00',
          endTime: '16:15:00',
        },
      ],
    })
  })
})

describe('SchedulingPreferencesForm validation errors', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders ApiError.details messages on failed save', () => {
    mockLoadedPreferences({ ...defaultPreferences, persisted: true })
    mockSaveMutation(vi.fn(), {
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: {
          workDayStart: ['Work day start must be before work day end'],
        },
      }),
    })

    renderForm()

    expect(
      screen.getByText('Work day start must be before work day end'),
    ).toBeInTheDocument()
  })
})

describe('SchedulingPreferencesForm peak copy', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('explains that the peak window is visual only', () => {
    mockLoadedPreferences({ ...defaultPreferences, persisted: true })
    mockSaveMutation()

    renderForm()

    expect(
      screen.getByText(/peak window is visual only/i),
    ).toBeInTheDocument()
  })
})
