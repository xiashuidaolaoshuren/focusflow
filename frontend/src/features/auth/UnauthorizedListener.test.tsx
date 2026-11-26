import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UnauthorizedListener } from '@/features/auth/UnauthorizedListener'
import { currentUserQueryKey } from '@/lib/query'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return { ...actual, onUnauthorized: vi.fn() }
})

import { onUnauthorized } from '@/lib/api'

const mockedOnUnauthorized = vi.mocked(onUnauthorized)

function renderListener(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <UnauthorizedListener />
    </QueryClientProvider>,
  )
}

describe('UnauthorizedListener', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('clears the cached session when a request returns 401', () => {
    let handler: (() => void) | undefined
    mockedOnUnauthorized.mockImplementation((next) => {
      handler = next
      return () => {}
    })

    const queryClient = new QueryClient()
    queryClient.setQueryData(currentUserQueryKey, {
      id: 1,
      email: 'user@example.com',
      username: 'user',
    })

    renderListener(queryClient)

    expect(mockedOnUnauthorized).toHaveBeenCalledTimes(1)
    handler?.()

    expect(queryClient.getQueryData(currentUserQueryKey)).toBeNull()
  })

  it('leaves an anonymous session alone when a 401 arrives', () => {
    let handler: (() => void) | undefined
    mockedOnUnauthorized.mockImplementation((next) => {
      handler = next
      return () => {}
    })

    const queryClient = new QueryClient()

    renderListener(queryClient)
    handler?.()

    expect(queryClient.getQueryData(currentUserQueryKey)).toBeUndefined()
  })
})
