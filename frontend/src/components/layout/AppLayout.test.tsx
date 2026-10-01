import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AppLayout } from '@/components/layout/AppLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { TooltipProvider } from '@/components/ui/tooltip'

vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
  useLogout: vi.fn(),
}))

import { useCurrentUser, useLogout } from '@/features/auth/hooks'

const mockedUseCurrentUser = vi.mocked(useCurrentUser)
const mockedUseLogout = vi.mocked(useLogout)

function renderAppLayout(initialPath = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<div>Dashboard content</div>} />
                <Route path="/settings" element={<div>Settings content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

async function openUserMenu() {
  fireEvent.click(screen.getByRole('button', { name: /user menu/i }))
  await waitFor(() => {
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
}

function mockAuthForLayout() {
  mockedUseCurrentUser.mockReturnValue({
    user: { id: 1, email: 'user@example.com', username: 'user' },
    isAuthenticated: true,
  } as ReturnType<typeof useCurrentUser>)
  mockedUseLogout.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useLogout>)
}

describe('AppLayout accessibility', () => {
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
    mockAuthForLayout()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a skip to content link targeting main content', () => {
    renderAppLayout()

    const skipLink = screen.getByRole('link', { name: /skip to (main )?content/i })
    expect(skipLink).toHaveAttribute('href', '#main-content')
  })

  it('provides a main-content skip target', () => {
    renderAppLayout()

    expect(document.getElementById('main-content')).not.toBeNull()
  })

  it('exposes accessible names for shell controls', () => {
    renderAppLayout()

    expect(
      screen.getByRole('button', { name: /toggle sidebar/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /user menu/i }),
    ).toBeInTheDocument()
  })
})

describe('AppLayout navigation', () => {
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
    mockAuthForLayout()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders a Settings link in the sidebar', () => {
    renderAppLayout()

    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/settings',
    )
  })
})

describe('AppLayout user menu', () => {
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

  it('shows the current user email and triggers logout', async () => {
    const mutate = vi.fn()
    mockedUseCurrentUser.mockReturnValue({
      user: { id: 1, email: 'user@example.com', username: 'user' },
      isAuthenticated: true,
    } as ReturnType<typeof useCurrentUser>)
    mockedUseLogout.mockReturnValue({
      mutate,
      isPending: false,
    } as unknown as ReturnType<typeof useLogout>)

    renderAppLayout()
    await openUserMenu()

    expect(screen.getByText('user@example.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('menuitem', { name: /logout/i }))

    expect(mutate).toHaveBeenCalled()
  })

  it('disables logout while the mutation is pending', async () => {
    mockedUseCurrentUser.mockReturnValue({
      user: { id: 1, email: 'user@example.com', username: 'user' },
      isAuthenticated: true,
    } as ReturnType<typeof useCurrentUser>)
    mockedUseLogout.mockReturnValue({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useLogout>)

    renderAppLayout()
    await openUserMenu()

    expect(screen.getByRole('menuitem', { name: /logout/i })).toHaveAttribute(
      'data-disabled',
    )
  })
})
