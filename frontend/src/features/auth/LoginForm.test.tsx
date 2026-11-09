import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { LoginForm } from '@/features/auth/LoginForm'

vi.mock('@/features/auth/hooks', () => ({
  useLogin: vi.fn(),
}))

import { useLogin } from '@/features/auth/hooks'

const mockedUseLogin = vi.mocked(useLogin)

function renderLoginForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return {
    ...view,
    rerenderForm: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <LoginForm />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
  }
}

describe('LoginForm', () => {
  it('renders fields, submits credentials, and disables submit while pending', () => {
    const mutate = vi.fn()
    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    const { rerenderForm } = renderLoginForm()

    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'user' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(mutate).toHaveBeenCalledWith({
      username: 'user',
      password: 'password123',
    })

    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    rerenderForm()

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('shows a top-level alert when login fails', () => {
    mockedUseLogin.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 401,
        message: 'Invalid credentials',
      }),
    } as unknown as ReturnType<typeof useLogin>)

    renderLoginForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials')
  })

  it('marks fields invalid and shows an alert title when login fails', () => {
    mockedUseLogin.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 401,
        message: 'Invalid credentials',
      }),
    } as unknown as ReturnType<typeof useLogin>)

    renderLoginForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in failed')
    expect(screen.getByLabelText(/username/i)).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('moves focus to the error alert when login fails', () => {
    const mutate = vi.fn()
    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useLogin>)

    const { rerenderForm } = renderLoginForm()

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'user' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    mockedUseLogin.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 401,
        message: 'Invalid credentials',
      }),
    } as unknown as ReturnType<typeof useLogin>)

    rerenderForm()

    expect(screen.getByRole('alert')).toHaveFocus()
  })
})
