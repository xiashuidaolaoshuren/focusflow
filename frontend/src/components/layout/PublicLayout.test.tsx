import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { screen } from '@testing-library/dom'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PublicLayout } from '@/components/layout/PublicLayout'

vi.mock('@/features/auth/hooks', () => ({
  useCurrentUser: vi.fn(),
}))

import { useCurrentUser } from '@/features/auth/hooks'

const mockedUseCurrentUser = vi.mocked(useCurrentUser)

function renderPublicLayout() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/login" element={<div>Login page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PublicLayout', () => {
  it('wraps the outlet content in a main landmark', () => {
    mockedUseCurrentUser.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      data: null,
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useCurrentUser>)

    renderPublicLayout()

    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('loads the current user on mount to seed the CSRF cookie', () => {
    mockedUseCurrentUser.mockReturnValue({
      isPending: false,
      isSuccess: true,
      isError: false,
      data: null,
      user: null,
      isAuthenticated: false,
    } as ReturnType<typeof useCurrentUser>)

    renderPublicLayout()

    expect(mockedUseCurrentUser).toHaveBeenCalled()
  })
})
