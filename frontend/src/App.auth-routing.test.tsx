import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { SchedulingPreferencesResponse, UserResponse } from '@/types/api'

vi.mock('@/features/auth/api', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

vi.mock('@/features/tasks/api', () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}))

vi.mock('@/features/preferences/api', () => ({
  getSchedulingPreferences: vi.fn(),
  updateSchedulingPreferences: vi.fn(),
}))

vi.mock('@/features/horizon/hooks', () => ({
  useHorizon: vi.fn(),
  horizonQueryPrefix: ['horizon'],
  horizonQueryKey: vi.fn(),
}))

import { getCurrentUser } from '@/features/auth/api'
import { useHorizon } from '@/features/horizon/hooks'
import { getSchedulingPreferences } from '@/features/preferences/api'
import { listTasks } from '@/features/tasks/api'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedGetSchedulingPreferences = vi.mocked(getSchedulingPreferences)
const mockedListTasks = vi.mocked(listTasks)
const mockedUseHorizon = vi.mocked(useHorizon)

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
  workingDays: [
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
  ],
  persisted: false,
}

function renderApp(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <App />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('App auth routing', () => {
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
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  beforeEach(() => {
    mockedListTasks.mockResolvedValue([])
    mockedGetSchedulingPreferences.mockResolvedValue(defaultPreferences)
    mockedUseHorizon.mockReturnValue({
      horizon: {
        currentDate: '2026-06-01',
        currentTime: '09:00:00',
        assumptions: {
          pace: 'AS_PLANNED',
          workingDays: defaultPreferences.workingDays,
          horizonWorkingDays: 7,
        },
        days: [],
        tasks: [],
      },
      isPending: false,
      isError: false,
      refetch: vi.fn(),
      currentDate: '2026-06-01',
      currentTime: '09:00',
    } as unknown as ReturnType<typeof useHorizon>)
  })

  it('redirects unauthenticated users away from protected routes', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/dashboard')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: /^tasks$/i })).not.toBeInTheDocument()
  })

  it('allows authenticated users to access protected routes', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/dashboard')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^tasks$/i })).toBeInTheDocument()
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: /sign in/i }),
    ).not.toBeInTheDocument()
  })

  it('shows loading session while session is restored on protected route refresh', async () => {
    let resolveUser!: (value: UserResponse | null) => void
    mockedGetCurrentUser.mockReturnValue(
      new Promise<UserResponse | null>((resolve) => {
        resolveUser = resolve
      }),
    )

    renderApp('/dashboard')

    expect(screen.getByRole('status')).toHaveTextContent(/loading session/i)
    expect(screen.queryByRole('heading', { name: /^tasks$/i })).not.toBeInTheDocument()

    resolveUser({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^tasks$/i })).toBeInTheDocument()
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/loading session/i)).not.toBeInTheDocument()
  })

  it('does not render authenticated shell controls after session is absent', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/dashboard')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument()
    })
    expect(
      screen.queryByRole('button', { name: /user menu/i }),
    ).not.toBeInTheDocument()
  })

  it('renders authenticated shell with user menu when session is valid', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/dashboard')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /user menu/i }),
      ).toBeInTheDocument()
    })
  })

  it('allows authenticated users to access /settings', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/settings')

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /scheduling preferences/i }),
      ).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /horizon', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/horizon')

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: /^horizon$/i })).not.toBeInTheDocument()
  })

  it('allows authenticated users to access /horizon', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/horizon')

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^horizon$/i })).toBeInTheDocument()
    })
  })
})
