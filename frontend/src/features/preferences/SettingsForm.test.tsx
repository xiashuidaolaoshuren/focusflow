import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SettingsForm } from '@/features/preferences/SettingsForm'
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
  workingDays: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'],
  persisted: true,
}

function mockLoaded(
  preferences: SchedulingPreferencesResponse = defaultPreferences,
  mutate = vi.fn(),
) {
  mockedUseSchedulingPreferences.mockReturnValue({
    preferences,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useSchedulingPreferences>)
  mockedUseUpdateSchedulingPreferences.mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useUpdateSchedulingPreferences>)
}

describe('SettingsForm loading', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('binds the loaded values into the time and number fields', () => {
    mockLoaded({
      ...defaultPreferences,
      workDayStart: '08:30:00',
      workDayEnd: '17:30:00',
      bufferMinutes: 5,
    })

    render(<SettingsForm />)

    const workWindow = screen.getByRole('region', { name: 'Work window' })
    expect(within(workWindow).getByLabelText('Start')).toHaveValue('08:30')
    expect(within(workWindow).getByLabelText('End')).toHaveValue('17:30')
    expect(within(workWindow).getByLabelText('Trailing buffer')).toHaveValue('5')
  })

  it('shows the defaults banner only when preferences are not persisted', () => {
    mockLoaded({ ...defaultPreferences, persisted: false })
    const { unmount } = render(<SettingsForm />)
    expect(screen.getByText('Defaults apply until saved')).toBeInTheDocument()
    unmount()

    mockLoaded({ ...defaultPreferences, persisted: true })
    render(<SettingsForm />)
    expect(
      screen.queryByText('Defaults apply until saved'),
    ).not.toBeInTheDocument()
  })

  it('renders no native date or time inputs', () => {
    mockLoaded()

    const { container } = render(<SettingsForm />)

    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(0)
  })
})

describe('SettingsForm save', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('saves the exact request with times, a null peak, and working days in order', async () => {
    const mutate = vi.fn()
    mockLoaded(
      {
        ...defaultPreferences,
        fixedBreaks: [{ label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' }],
      },
      mutate,
    )
    render(<SettingsForm />)

    const days = within(screen.getByRole('region', { name: 'Working days' }))
    fireEvent.click(days.getByRole('checkbox', { name: 'Saturday' }))
    fireEvent.click(days.getByRole('checkbox', { name: 'Monday' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({
        workDayStart: '09:00:00',
        workDayEnd: '18:00:00',
        cadenceEnabled: true,
        targetFocusMinutes: 50,
        breakMinutes: 10,
        minSessionMinutes: 15,
        bufferMinutes: 0,
        peakStart: null,
        peakEnd: null,
        fixedBreaks: [{ label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' }],
        workingDays: ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'],
      }),
    )
  })
})

describe('SettingsForm errors', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function mockSaveError(error: Error) {
    mockedUseUpdateSchedulingPreferences.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error,
    } as unknown as ReturnType<typeof useUpdateSchedulingPreferences>)
  }

  it('renders a server field error on the field it names', () => {
    mockLoaded()
    mockSaveError(
      new ApiError({
        status: 400,
        message: 'Invalid scheduling preferences',
        details: { breakMinutes: ['Break minutes must be at least 1'] },
      } as unknown as ConstructorParameters<typeof ApiError>[0]),
    )

    render(<SettingsForm />)

    expect(screen.getByText('Break minutes must be at least 1')).toBeInTheDocument()
  })

  it('shows a general save failure as an alert', () => {
    mockLoaded()
    mockSaveError(new Error('Server unavailable'))

    render(<SettingsForm />)

    expect(screen.getByRole('alert')).toHaveTextContent('Server unavailable')
  })

  it('blocks the save and explains when the work day ends before it starts', async () => {
    const mutate = vi.fn()
    mockLoaded(defaultPreferences, mutate)
    render(<SettingsForm />)

    const workWindow = within(screen.getByRole('region', { name: 'Work window' }))
    fireEvent.change(workWindow.getByLabelText('End'), { target: { value: '08:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(
        screen.getByText('Work day end must be after work day start'),
      ).toBeInTheDocument(),
    )
    expect(mutate).not.toHaveBeenCalled()
  })
})

describe('SettingsForm peak window', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('offers an optional peak window and says it is visual only', () => {
    mockLoaded()
    render(<SettingsForm />)

    const peak = within(screen.getByRole('region', { name: 'Peak window' }))

    expect(peak.getByText(/visual only/i)).toBeInTheDocument()
    expect(peak.getByLabelText('Start')).toHaveValue('')
    expect(peak.getByLabelText('End')).toHaveValue('')
  })
})

describe('SettingsForm working days', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows seven Monday-first day checkboxes bound from the loaded working days', () => {
    mockLoaded()
    render(<SettingsForm />)

    const days = within(screen.getByRole('region', { name: 'Working days' }))
    const boxes = days.getAllByRole('checkbox')

    expect(boxes.map((box) => box.closest('label')?.textContent?.trim())).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ])
    expect(boxes.map((box) => (box as HTMLInputElement).checked)).toEqual([
      true,
      true,
      true,
      true,
      true,
      false,
      false,
    ])
  })
})

describe('SettingsForm working day copy', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('explains that working days shape the horizon without forbidding daily plans', () => {
    mockLoaded()
    render(<SettingsForm />)

    expect(
      within(screen.getByRole('region', { name: 'Working days' })).getByText(
        /shape the horizon forecast/i,
      ),
    ).toBeInTheDocument()
  })
})

describe('SettingsForm fixed breaks', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('adds a fixed break to the form and the preview, and removes it from both', () => {
    mockLoaded()
    render(<SettingsForm />)
    const breaks = () => screen.getByRole('region', { name: 'Fixed breaks' })
    const preview = () => screen.getByRole('region', { name: 'Typical day' })

    expect(within(breaks()).getByText('No fixed breaks yet.')).toBeInTheDocument()

    fireEvent.click(within(breaks()).getByRole('button', { name: 'Add break' }))
    fireEvent.change(within(breaks()).getByLabelText('Label'), {
      target: { value: 'Lunch' },
    })
    fireEvent.change(within(breaks()).getByLabelText('Start'), {
      target: { value: '12:30' },
    })
    fireEvent.change(within(breaks()).getByLabelText('End'), {
      target: { value: '13:00' },
    })

    expect(
      within(preview()).getByRole('listitem', { name: /fixed break: lunch/i }),
    ).toBeInTheDocument()

    fireEvent.click(within(breaks()).getByRole('button', { name: 'Remove Lunch' }))

    expect(within(breaks()).queryByLabelText('Label')).not.toBeInTheDocument()
    expect(
      within(preview()).queryByRole('listitem', { name: /fixed break/i }),
    ).not.toBeInTheDocument()
  })

  it('requires a fixed break label before any request is sent', async () => {
    const mutate = vi.fn()
    mockLoaded(defaultPreferences, mutate)
    render(<SettingsForm />)
    const breaks = () => screen.getByRole('region', { name: 'Fixed breaks' })

    fireEvent.click(within(breaks()).getByRole('button', { name: 'Add break' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await within(breaks()).findByText('Label is required')).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows a server detail on the fixed break row it names', () => {
    mockLoaded({
      ...defaultPreferences,
      fixedBreaks: [{ label: 'Lunch', startTime: '12:00:00', endTime: '13:00:00' }],
    } as SchedulingPreferencesResponse)
    mockedUseUpdateSchedulingPreferences.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Invalid scheduling preferences',
        details: { 'fixedBreaks[0].label': ['Label is taken by a commitment'] },
      } as unknown as ConstructorParameters<typeof ApiError>[0]),
    } as unknown as ReturnType<typeof useUpdateSchedulingPreferences>)

    render(<SettingsForm />)

    expect(
      within(screen.getByRole('region', { name: 'Fixed breaks' })).getByText(
        'Label is taken by a commitment',
      ),
    ).toBeInTheDocument()
  })
})

describe('SettingsForm cancel', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('restores the saved values when Cancel is clicked after an edit', () => {
    mockLoaded()
    render(<SettingsForm />)
    const workWindow = within(screen.getByRole('region', { name: 'Work window' }))

    fireEvent.change(workWindow.getByLabelText('Start'), { target: { value: '10:00' } })
    expect(workWindow.getByLabelText('Start')).toHaveValue('10:00')

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(workWindow.getByLabelText('Start')).toHaveValue('09:00')
  })
})

describe('SettingsForm typical day preview', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('labels the preview and shows focus and session totals for the default day', () => {
    mockLoaded()
    render(<SettingsForm />)
    const preview = () => screen.getByRole('region', { name: 'Typical day' })

    expect(within(preview()).getByText('Preview')).toBeInTheDocument()
    expect(within(preview()).getByText('Focus per day')).toBeInTheDocument()
    expect(within(preview()).getByText('Sessions')).toBeInTheDocument()
    // 09:00–18:00 with 50/10 cadence and 15 min minimum: nine 50-minute sessions.
    expect(within(preview()).getByText('9')).toBeInTheDocument()
  })

  it('marks the peak window on the preview rail', () => {
    mockLoaded({
      ...defaultPreferences,
      peakStart: '12:00:00',
      peakEnd: '14:00:00',
    } as SchedulingPreferencesResponse)
    render(<SettingsForm />)

    expect(
      within(screen.getByRole('region', { name: 'Typical day' })).getByLabelText('Peak window'),
    ).toBeInTheDocument()
  })
})

describe('SettingsForm focus cadence', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  function cadenceBlocksInPreview() {
    const preview = screen.getByRole('region', { name: 'Typical day' })
    return within(preview)
      .queryAllByRole('listitem')
      .filter((item) => /cadence break/i.test(item.getAttribute('aria-label') ?? ''))
  }

  it('hides the focus session and cadence break fields and their preview blocks when cadence is off', () => {
    mockLoaded()
    render(<SettingsForm />)

    expect(screen.getByLabelText('Focus session')).toBeInTheDocument()
    expect(cadenceBlocksInPreview().length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('switch', { name: 'Enable focus cadence' }))

    expect(screen.queryByLabelText('Focus session')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cadence break')).not.toBeInTheDocument()
    expect(cadenceBlocksInPreview()).toHaveLength(0)
  })

  it('keeps the minimum session field visible whether cadence is on or off', () => {
    mockLoaded({ ...defaultPreferences, minSessionMinutes: 20 })
    render(<SettingsForm />)

    expect(screen.getByLabelText('Minimum session')).toHaveValue('20')

    fireEvent.click(screen.getByRole('switch', { name: 'Enable focus cadence' }))

    expect(screen.getByLabelText('Minimum session')).toHaveValue('20')
  })

  it('restores both fields and the cadence breaks when cadence is turned back on', () => {
    mockLoaded({ ...defaultPreferences, cadenceEnabled: false })
    render(<SettingsForm />)

    expect(screen.queryByLabelText('Focus session')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'Enable focus cadence' }))

    expect(screen.getByLabelText('Focus session')).toBeInTheDocument()
    expect(screen.getByLabelText('Cadence break')).toBeInTheDocument()
    expect(cadenceBlocksInPreview().length).toBeGreaterThan(0)
  })
})
