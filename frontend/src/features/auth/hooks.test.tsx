import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { waitFor } from '@testing-library/dom'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, useLocation } from 'react-router-dom'

import type { UserResponse } from '@/types/api'

import {
  useCurrentUser,
  useLogin,
  useLogout,
  useRegister,
} from '@/features/auth/hooks'
import { currentUserQueryKey } from '@/lib/query'

vi.mock('@/features/auth/api', () => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}))

import { getCurrentUser, login, logout, register } from '@/features/auth/api'

const mockedGetCurrentUser = vi.mocked(getCurrentUser)
const mockedLogin = vi.mocked(login)
const mockedRegister = vi.mocked(register)
const mockedLogout = vi.mocked(logout)

function createWrapper(queryClient?: QueryClient) {
  const client =
    queryClient ??
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/login']}>{children}</MemoryRouter>
      </QueryClientProvider>
    )
  }
}

function LocationDisplay() {
  const location = useLocation()
  return <div data-testid="location">{location.pathname}</div>
}

describe('useCurrentUser', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('uses a stable query key for the current user', () => {
    expect(currentUserQueryKey).toEqual(['auth', 'me'])
  })

  it('returns the authenticated user when the session is valid', async () => {
    const user: UserResponse = {
      id: 1,
      email: 'user@example.com',
      username: 'user',
    }
    mockedGetCurrentUser.mockResolvedValue(user)

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedGetCurrentUser).toHaveBeenCalled()
    expect(result.current.data).toEqual(user)
    expect(result.current.isAuthenticated).toBe(true)
  })

  it('returns unauthenticated state when no user session exists', async () => {
    mockedGetCurrentUser.mockResolvedValue(null)

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBeNull()
    expect(result.current.isAuthenticated).toBe(false)
  })
})

describe('useLogin', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets current user query data and navigates to /dashboard on success', async () => {
    const user: UserResponse = {
      id: 1,
      email: 'user@example.com',
      username: 'user',
    }
    mockedLogin.mockResolvedValue(user)
    // Refetch after invalidate can still return null briefly; auth must not
    // depend on that race — login response should seed the cache immediately.
    mockedGetCurrentUser.mockResolvedValue(null)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(currentUserQueryKey, null)
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(
      () => ({
        login: useLogin(),
        currentUser: useCurrentUser(),
        location: useLocation(),
      }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/login']}>
              {children}
              <LocationDisplay />
            </MemoryRouter>
          </QueryClientProvider>
        ),
      },
    )

    result.current.login.mutate({ username: 'user', password: 'password123' })

    await waitFor(() => expect(result.current.login.isSuccess).toBe(true))

    expect(mockedLogin).toHaveBeenCalledWith({
      username: 'user',
      password: 'password123',
    })
    expect(setQueryDataSpy).toHaveBeenCalledWith(currentUserQueryKey, user)
    expect(queryClient.getQueryData(currentUserQueryKey)).toEqual(user)
    expect(result.current.currentUser.isAuthenticated).toBe(true)
    expect(result.current.location.pathname).toBe('/dashboard')
  })

  it('waits for the CSRF seed query before calling login', async () => {
    const user: UserResponse = {
      id: 1,
      email: 'user@example.com',
      username: 'user',
    }
    mockedLogin.mockResolvedValue(user)

    let resolveSeed: (value: UserResponse | null) => void
    const seedPromise = new Promise<UserResponse | null>((resolve) => {
      resolveSeed = resolve
    })
    mockedGetCurrentUser.mockReturnValue(seedPromise)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    const { result } = renderHook(() => useLogin(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({ username: 'user', password: 'password123' })

    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalled())
    expect(mockedLogin).not.toHaveBeenCalled()

    resolveSeed!(null)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedLogin).toHaveBeenCalledWith({
      username: 'user',
      password: 'password123',
    })
  })
})

describe('useRegister', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('sets current user query data and navigates to /dashboard on success', async () => {
    const user: UserResponse = {
      id: 2,
      email: 'new@example.com',
      username: 'newuser',
    }
    mockedRegister.mockResolvedValue(user)
    mockedGetCurrentUser.mockResolvedValue(null)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')

    const { result } = renderHook(
      () => ({
        register: useRegister(),
        location: useLocation(),
      }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/register']}>
              {children}
              <LocationDisplay />
            </MemoryRouter>
          </QueryClientProvider>
        ),
      },
    )

    result.current.register.mutate({
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    })

    await waitFor(() => expect(result.current.register.isSuccess).toBe(true))

    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    })
    expect(setQueryDataSpy).toHaveBeenCalledWith(currentUserQueryKey, user)
    expect(result.current.location.pathname).toBe('/dashboard')
  })

  it('waits for the CSRF seed query before calling register', async () => {
    const user: UserResponse = {
      id: 2,
      email: 'new@example.com',
      username: 'newuser',
    }
    mockedRegister.mockResolvedValue(user)

    let resolveSeed: (value: UserResponse | null) => void
    const seedPromise = new Promise<UserResponse | null>((resolve) => {
      resolveSeed = resolve
    })
    mockedGetCurrentUser.mockReturnValue(seedPromise)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })

    const { result } = renderHook(() => useRegister(), {
      wrapper: createWrapper(queryClient),
    })

    result.current.mutate({
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    })

    await waitFor(() => expect(mockedGetCurrentUser).toHaveBeenCalled())
    expect(mockedRegister).not.toHaveBeenCalled()

    resolveSeed!(null)

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockedRegister).toHaveBeenCalledWith({
      email: 'new@example.com',
      username: 'newuser',
      password: 'password123',
    })
  })
})

describe('useLogout', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears auth cache and navigates to /login on success', async () => {
    mockedLogout.mockResolvedValue(undefined)

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')
    const clearSpy = vi.spyOn(queryClient, 'clear')

    const { result } = renderHook(
      () => ({
        logout: useLogout(),
        location: useLocation(),
      }),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={['/dashboard']}>
              {children}
              <LocationDisplay />
            </MemoryRouter>
          </QueryClientProvider>
        ),
      },
    )

    result.current.logout.mutate()

    await waitFor(() => expect(result.current.logout.isSuccess).toBe(true))

    expect(mockedLogout).toHaveBeenCalled()
    expect(setQueryDataSpy).toHaveBeenCalledWith(currentUserQueryKey, null)
    expect(clearSpy).toHaveBeenCalled()
    expect(result.current.location.pathname).toBe('/login')
  })
})
