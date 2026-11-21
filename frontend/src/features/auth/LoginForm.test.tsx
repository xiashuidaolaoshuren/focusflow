import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor } from '@testing-library/dom'
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

function mockLogin(state: {
  mutate?: ReturnType<typeof vi.fn>
  isPending?: boolean
  isError?: boolean
  error?: Error | null
}) {
  mockedUseLogin.mockReturnValue({
    mutate: state.mutate ?? vi.fn(),
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useLogin>)
}

describe('LoginForm', () => {
  it('renders a real form that submits credentials', async () => {
    const mutate = vi.fn()
    mockLogin({ mutate })

    renderLoginForm()

    const username = screen.getByLabelText(/username/i)
    const password = screen.getByLabelText(/password/i)
    const submit = screen.getByRole('button', { name: /sign in/i })

    expect(submit.closest('form')).not.toBeNull()
    expect(username).toHaveAttribute('autocomplete', 'username')
    expect(password).toHaveAttribute('autocomplete', 'current-password')

    fireEvent.change(username, { target: { value: 'user' } })
    fireEvent.change(password, { target: { value: 'password123' } })
    fireEvent.submit(submit.closest('form')!)

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        username: 'user',
        password: 'password123',
      })
    })
  })

  it('shows inline validation errors and does not submit when empty', async () => {
    const mutate = vi.fn()
    mockLogin({ mutate })

    renderLoginForm()

    fireEvent.submit(
      screen.getByRole('button', { name: /sign in/i }).closest('form')!,
    )

    expect(await screen.findByText(/enter your username/i)).toBeInTheDocument()
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows a top-level alert when login fails', () => {
    mockLogin({
      isError: true,
      error: new ApiError({ status: 401, message: 'Invalid credentials' }),
    })

    renderLoginForm()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Invalid credentials')
    expect(alert).not.toHaveTextContent(/sign-in failed/i)
  })

  it('shows API field errors inline', () => {
    mockLogin({
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: { username: ['Unknown username'] },
      }),
    })

    renderLoginForm()

    expect(screen.getByText('Unknown username')).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('disables submit while pending', () => {
    mockLogin({ isPending: true })

    renderLoginForm()

    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
  })

  it('shows the required marker and the alternate link copy', () => {
    mockLogin({})

    renderLoginForm()

    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(/new to focusflow\?/i).closest('p'),
    ).toHaveTextContent(/create account/i)
  })

  it('validates a field when it loses focus', async () => {
    mockLogin({})

    renderLoginForm()

    fireEvent.focusOut(screen.getByLabelText(/username/i))

    expect(await screen.findByText(/enter your username/i)).toBeInTheDocument()
  })

  it('moves focus to the error alert when login fails', () => {
    mockLogin({})

    const { rerenderForm } = renderLoginForm()

    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'user' },
    })
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'wrong' },
    })

    mockLogin({
      isError: true,
      error: new ApiError({ status: 401, message: 'Invalid credentials' }),
    })
    rerenderForm()

    expect(screen.getByRole('alert')).toHaveFocus()
  })
})
