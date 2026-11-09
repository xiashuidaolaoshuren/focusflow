import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor, within } from '@testing-library/dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '@/components/layout/AppShell'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
  useLogout: vi.fn(),
}))

vi.mock('@/features/preferences/hooks', () => ({
  useSchedulingPreferences: vi.fn(),
}))

import { useCurrentUser, useLogout } from '@/features/auth/hooks'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import { formatDateLabel } from '@/lib/format'
import { getLocalDateString } from '@/lib/planningDate'

const mockedUseCurrentUser = vi.mocked(useCurrentUser)
const mockedUseLogout = vi.mocked(useLogout)
const mockedUseSchedulingPreferences = vi.mocked(useSchedulingPreferences)

function mockPreferences(
  value: {
    workDayStart: string
    workDayEnd: string
  } | null,
) {
  mockedUseSchedulingPreferences.mockReturnValue({
    preferences: value,
    isPending: value === null,
    data: value,
  } as unknown as ReturnType<typeof useSchedulingPreferences>)
}

function renderAppShell(initialPath = '/today') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/today" element={<div>Today content</div>} />
                <Route path="/tasks" element={<div>Tasks content</div>} />
                <Route path="/horizon" element={<div>Horizon content</div>} />
                <Route path="/plans" element={<div>Plans content</div>} />
                <Route path="/settings" element={<div>Settings content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

function mockAuth() {
  mockedUseCurrentUser.mockReturnValue({
    user: { id: 1, email: 'user@example.com', username: 'user' },
    isAuthenticated: true,
  } as ReturnType<typeof useCurrentUser>)
  mockedUseLogout.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useLogout>)
}

async function openUserMenu() {
  fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
  await waitFor(() => {
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
}

describe('AppShell', () => {
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
    mockAuth()
    mockPreferences({ workDayStart: '09:00:00', workDayEnd: '18:00:00' })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a skip link and a main-content target', () => {
    renderAppShell()

    expect(
      screen.getByRole('link', { name: /skip to (main )?content/i }),
    ).toHaveAttribute('href', '#main-content')
    expect(document.getElementById('main-content')).not.toBeNull()
  })

  it('renders the product navigation in order', () => {
    renderAppShell()

    const nav = screen.getByRole('navigation', { name: /main/i })
    const navLinks = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent?.trim())

    expect(navLinks).toEqual(['Today', 'Tasks', 'Horizon', 'Plans', 'Settings'])
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute(
      'href',
      '/today',
    )
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings',
    )
  })

  it('marks the current page in the navigation', () => {
    renderAppShell('/plans')

    expect(screen.getByRole('link', { name: 'Plans' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('shows the working day and work window from preferences', () => {
    renderAppShell()

    expect(screen.getByText('Working day')).toBeInTheDocument()
    expect(
      screen.getByText(formatDateLabel(getLocalDateString())),
    ).toBeInTheDocument()
    expect(screen.getByText(/work window/i).textContent).toContain(
      '09:00–18:00',
    )
  })

  it('collapses the sidebar to an icon rail and expands it again', () => {
    renderAppShell()

    const collapse = screen.getByRole('button', { name: /collapse sidebar/i })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(collapse)

    const expand = screen.getByRole('button', { name: /expand sidebar/i })
    expect(expand).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(expand)

    expect(
      screen.getByRole('button', { name: /collapse sidebar/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('hides the working day block while preferences load', () => {
    mockPreferences(null)

    renderAppShell()

    expect(screen.queryByText('Working day')).not.toBeInTheDocument()
  })

  it('exposes the shell controls', () => {
    renderAppShell()

    expect(
      screen.getByRole('button', { name: /open navigation/i }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /switch to (dark|light) mode/i })
        .length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: /user menu/i }),
    ).toBeInTheDocument()
  })

  it('shows the current user email and triggers sign out', async () => {
    const mutate = vi.fn()
    mockedUseLogout.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useLogout>)

    renderAppShell()
    await openUserMenu()

    expect(screen.getAllByText('user@example.com').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }))

    expect(mutate).toHaveBeenCalled()
  })

  it('offers Settings and Sign out in the user menu', async () => {
    renderAppShell()
    await openUserMenu()

    expect(
      screen.getByRole('menuitem', { name: /settings/i }),
    ).toHaveAttribute('href', '/settings')
    expect(
      screen.getByRole('menuitem', { name: /sign out/i }),
    ).toBeInTheDocument()
  })

  it('disables sign out while the mutation is pending', async () => {
    mockedUseLogout.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useLogout>)

    renderAppShell()
    await openUserMenu()

    expect(
      screen.getByRole('menuitem', { name: /sign out/i }),
    ).toHaveAttribute('data-disabled')
  })
})

describe('AppShell mobile drawer', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    })
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
    mockAuth()
  })

  afterEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })
  })

  it('shows navigation and theme controls in the mobile top bar', () => {
    renderAppShell()

    expect(
      screen.getByRole('button', { name: /open navigation/i }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /switch to (dark|light) mode/i })
        .length,
    ).toBeGreaterThan(0)
  })

  it('opens from the menu button and closes on Escape, returning focus', async () => {
    renderAppShell()

    const menuButton = screen.getByRole('button', { name: /open navigation/i })
    fireEvent.click(menuButton)

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Today' })).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(menuButton).toHaveFocus()
    })
  })
})
