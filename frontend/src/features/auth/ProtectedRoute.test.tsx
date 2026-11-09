import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ProtectedRoute } from '@/features/auth/ProtectedRoute'

vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
}))

import { useCurrentUser } from '@/features/auth/hooks'

const mockedUseCurrentUser = vi.mocked(useCurrentUser)

function renderProtectedRoute(initialPath = '/dashboard') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<div>Dashboard content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProtectedRoute', () => {
  it('shows loading UI while the current user query is pending', () => {
    mockedUseCurrentUser.mockReturnValue({
      isPending: true,
      isSuccess: false,
      isError: false,
      data: undefined,
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useCurrentUser>)

    const { container } = renderProtectedRoute()

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(/loading/i)
    expect(status).toHaveAttribute('aria-live', 'polite')
    const spinner = container.querySelector('svg')
    expect(spinner).not.toBeNull()
    expect(spinner).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('redirects unauthenticated users to /login', () => {
    mockedUseCurrentUser.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      data: null,
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useCurrentUser>)

    renderProtectedRoute()

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('renders nested routes when the user is authenticated', () => {
    mockedUseCurrentUser.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      data: { id: 1, email: 'user@example.com', username: 'user' },
      user: { id: 1, email: 'user@example.com', username: 'user' },
      isAuthenticated: true,
    } as ReturnType<typeof useCurrentUser>)

    renderProtectedRoute()

    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })
})
