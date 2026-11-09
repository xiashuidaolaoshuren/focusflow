import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthLayout } from '@/components/layout/AuthLayout'
import { ThemeProvider } from '@/components/theme/ThemeProvider'

vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
}))

import { useCurrentUser } from '@/features/auth/hooks'

const mockedUseCurrentUser = vi.mocked(useCurrentUser)

function renderAuthLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <Routes>
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<div>Login page</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ThemeProvider>,
  )
}

describe('AuthLayout', () => {
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
    mockedUseCurrentUser.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      data: null,
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useCurrentUser>)
  })

  it('wraps the outlet content in a main landmark', () => {
    renderAuthLayout()

    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('offers the theme toggle', () => {
    renderAuthLayout()

    expect(
      screen.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeInTheDocument()
  })

  it('loads the current user on mount to seed the CSRF cookie', () => {
    renderAuthLayout()

    expect(mockedUseCurrentUser).toHaveBeenCalled()
  })
})
