import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen, waitFor } from '@testing-library/dom'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api'
import { RegisterForm } from '@/features/auth/RegisterForm'

vi.mock('@/features/auth/hooks', () => ({
  useRegister: vi.fn(),
}))

import { useRegister } from '@/features/auth/hooks'

const mockedUseRegister = vi.mocked(useRegister)

function renderRegisterForm() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function mockRegister(state: {
  mutate?: ReturnType<typeof vi.fn>
  isPending?: boolean
  isError?: boolean
  error?: Error | null
}) {
  mockedUseRegister.mockReturnValue({
    mutate: state.mutate ?? vi.fn(),
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
    error: state.error ?? null,
  } as unknown as ReturnType<typeof useRegister>)
}

function submitForm() {
  fireEvent.submit(
    screen.getByRole('button', { name: /create account/i }).closest('form')!,
  )
}

describe('RegisterForm', () => {
  it('renders a real form that submits credentials', async () => {
    const mutate = vi.fn()
    mockRegister({ mutate })

    renderRegisterForm()

    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      'autocomplete',
      'username',
    )
    expect(screen.getByLabelText(/^password/i)).toHaveAttribute(
      'autocomplete',
      'new-password',
    )

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    })
    submitForm()

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledWith({
        email: 'new@example.com',
        username: 'newuser',
        password: 'password123',
      })
    })
  })

  it('shows inline validation errors and does not submit when empty', async () => {
    const mutate = vi.fn()
    mockRegister({ mutate })

    renderRegisterForm()
    submitForm()

    expect(await screen.findByText(/enter your email/i)).toBeInTheDocument()
    expect(screen.getByText(/enter a username/i)).toBeInTheDocument()
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('rejects an invalid email address', async () => {
    const mutate = vi.fn()
    mockRegister({ mutate })

    renderRegisterForm()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'not-an-email' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    })
    submitForm()

    expect(
      await screen.findByText(/use an email like name@example\.com/i),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('rejects a password shorter than 8 characters', async () => {
    const mutate = vi.fn()
    mockRegister({ mutate })

    renderRegisterForm()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: '1234567' },
    })
    submitForm()

    expect(
      await screen.findByText(/use at least 8 characters/i),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('rejects a username outside 3 to 30 characters', async () => {
    const mutate = vi.fn()
    mockRegister({ mutate })

    renderRegisterForm()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'ab' },
    })
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: 'password123' },
    })
    submitForm()

    expect(
      await screen.findByText(/use at least 3 characters/i),
    ).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows the required markers, password hint, and alternate link copy', () => {
    mockRegister({})

    renderRegisterForm()

    expect(screen.getAllByText('*').length).toBeGreaterThanOrEqual(3)
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(
      screen.getByText(/have an account\?/i).closest('p'),
    ).toHaveTextContent(/sign in/i)
  })

  it('shows inline field errors from ApiError details', () => {
    mockRegister({
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: {
          email: ['Email is invalid'],
          username: ['Username already taken'],
          password: ['Password is too short'],
        },
      }),
    })

    renderRegisterForm()

    expect(screen.getByText('Email is invalid')).toBeInTheDocument()
    expect(screen.getByText('Username already taken')).toBeInTheDocument()
    expect(screen.getByText('Password is too short')).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('shows a top-level alert for non-field errors', () => {
    mockRegister({
      isError: true,
      error: new ApiError({ status: 500, message: 'Unexpected error' }),
    })

    renderRegisterForm()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Unexpected error')
    expect(alert).not.toHaveTextContent(/registration failed/i)
  })

  it('disables submit while pending', () => {
    mockRegister({ isPending: true })

    renderRegisterForm()

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeDisabled()
  })

  it('moves focus to the error alert when registration fails', () => {
    mockRegister({})

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const view = render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    mockRegister({
      isError: true,
      error: new ApiError({ status: 500, message: 'Unexpected error' }),
    })
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <RegisterForm />
        </MemoryRouter>
      </QueryClientProvider>,
    )

    expect(screen.getByRole('alert')).toHaveFocus()
  })
})
