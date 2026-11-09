import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { fireEvent, screen } from '@testing-library/dom'
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

  const view = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RegisterForm />
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return {
    ...view,
    rerenderForm: () =>
      view.rerender(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <RegisterForm />
          </MemoryRouter>
        </QueryClientProvider>,
      ),
  }
}

describe('RegisterForm', () => {
  it('renders fields, submits credentials, and disables submit while pending', () => {
    const mutate = vi.fn()
    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRegister>)

    const { rerenderForm } = renderRegisterForm()

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    expect(mutate).toHaveBeenCalledWith({
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    })

    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: true,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRegister>)

    rerenderForm()

    expect(
      screen.getByRole('button', { name: /create account/i }),
    ).toBeDisabled()
  })

  it('shows inline field errors from ApiError details', () => {
    mockedUseRegister.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 400,
        message: 'Validation failed',
        details: { username: ['Username already taken'] },
      }),
    } as unknown as ReturnType<typeof useRegister>)

    renderRegisterForm()

    expect(screen.getByText('Username already taken')).toBeInTheDocument()
  })

  it('shows a top-level alert for non-field errors', () => {
    mockedUseRegister.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 500,
        message: 'Unexpected error',
      }),
    } as unknown as ReturnType<typeof useRegister>)

    renderRegisterForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Unexpected error')
  })

  it('links field errors via aria-describedby and shows an alert title', () => {
    mockedUseRegister.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
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
    } as unknown as ReturnType<typeof useRegister>)

    renderRegisterForm()

    expect(screen.getByRole('alert')).toHaveTextContent('Registration failed')
    expect(screen.getByLabelText(/email/i)).toHaveAttribute(
      'aria-describedby',
      'email-error',
    )
    expect(screen.getByText('Email is invalid')).toHaveAttribute(
      'id',
      'email-error',
    )
    expect(screen.getByLabelText(/username/i)).toHaveAttribute(
      'aria-describedby',
      'username-error',
    )
    expect(screen.getByText('Username already taken')).toHaveAttribute(
      'id',
      'username-error',
    )
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'aria-describedby',
      'password-error',
    )
    expect(screen.getByText('Password is too short')).toHaveAttribute(
      'id',
      'password-error',
    )
  })

  it('moves focus to the error alert when registration fails', () => {
    const mutate = vi.fn()
    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: false,
      isError: false,
      error: null,
    } as unknown as ReturnType<typeof useRegister>)

    const { rerenderForm } = renderRegisterForm()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'new@example.com' },
    })
    fireEvent.change(screen.getByLabelText(/username/i), {
      target: { value: 'newuser' },
    })
    fireEvent.change(screen.getByLabelText(/^password$/i), {
      target: { value: 'password123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    mockedUseRegister.mockReturnValue({
      mutate,
      isPending: false,
      isError: true,
      error: new ApiError({
        status: 500,
        message: 'Unexpected error',
      }),
    } as unknown as ReturnType<typeof useRegister>)

    rerenderForm()

    expect(screen.getByRole('alert')).toHaveFocus()
  })
})
