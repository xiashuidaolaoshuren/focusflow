import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen, waitFor } from '@testing-library/dom'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { formatDateLabel } from '@/lib/format'
import { getLocalDateString } from '@/lib/planningDate'
import type { SchedulingPreferencesResponse, UserResponse } from '@/types/api'

const todayHeading = formatDateLabel(getLocalDateString())

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
}))

vi.mock('@/features/plans/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/plans/api')>()
  return {
    ...actual,
    getPlanByDate: vi.fn(async () => null),
  }
})

vi.mock('@/features/commitments/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/features/commitments/api')>()
  return {
    ...actual,
    listCommitments: vi.fn(async () => []),
  }
})

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

// Lazy routes plus the session query can exceed the 1s default under a full
// suite run; this keeps the routing assertions deterministic.
function waitForApp(callback: () => void) {
  return waitFor(callback, { timeout: 5000 })
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

  it('redirects unauthenticated users away from /today', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/today')

    await waitForApp(() => {
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: todayHeading })).not.toBeInTheDocument()
  })

  it('allows authenticated users to access /today', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/today')

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: todayHeading }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('region', { name: /today at a glance/i }),
      ).toBeInTheDocument()
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

    renderApp('/today')

    expect(screen.getByRole('status')).toHaveTextContent(/loading session/i)
    expect(
      screen.queryByRole('heading', { name: todayHeading }),
    ).not.toBeInTheDocument()

    resolveUser({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: todayHeading }),
      ).toBeInTheDocument()
    })
    expect(screen.queryByText(/loading session/i)).not.toBeInTheDocument()
  })

  it('does not render authenticated shell controls after session is absent', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/today')

    await waitForApp(() => {
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

    renderApp('/today')

    await waitForApp(() => {
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

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: 'Settings' }),
      ).toBeInTheDocument()
    })
  })

  it('redirects unauthenticated users away from /horizon', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/horizon')

    await waitForApp(() => {
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

    await waitForApp(() => {
      expect(screen.getByRole('heading', { name: /^horizon$/i })).toBeInTheDocument()
    })
  })

  it('sends anonymous visitors at / to /login', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/')

    await waitForApp(() => {
      expect(
        screen.getByRole('button', { name: /sign in/i }),
      ).toBeInTheDocument()
    })
  })

  it('sends authenticated visitors at / to /today', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/')

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: todayHeading }),
      ).toBeInTheDocument()
    })
  })

  it('lets authenticated users reach /tasks', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/tasks')

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: /^tasks$/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole('tablist', { name: /task filter/i }),
      ).toBeInTheDocument()
      expect(screen.getByText(/no tasks yet/i)).toBeInTheDocument()
    })
  })

  it('renders the 404 page for unknown paths', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    renderApp('/unknown')

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: /page not found/i }),
      ).toBeInTheDocument()
    })
    expect(screen.getByText('/unknown')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /go to today/i })).toHaveAttribute(
      'href',
      '/today',
    )
    expect(
      screen.queryByRole('navigation', { name: /main/i }),
    ).not.toBeInTheDocument()
  })

  it('keeps the shell around the 404 for authenticated users', async () => {
    mockedGetCurrentUser.mockResolvedValue({
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderApp('/unknown')

    await waitForApp(() => {
      expect(
        screen.getByRole('heading', { name: /page not found/i }),
      ).toBeInTheDocument()
    })
    expect(
      screen.getByRole('navigation', { name: /main/i }),
    ).toBeInTheDocument()
  })
})
