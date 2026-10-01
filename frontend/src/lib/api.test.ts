import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiRequest, ApiError } from '@/lib/api'
import type { ApiErrorResponse, LoginRequest, UserResponse } from '@/types/api'

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends credentials on every request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiRequest('/api/auth/me')

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('serializes JSON request bodies and parses JSON responses', async () => {
    const user: UserResponse = { id: 1, email: 'a@b.com', username: 'user' }
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const loginBody: LoginRequest = { username: 'user', password: 'secret' }
    const result = await apiRequest<UserResponse>('/api/auth/login', {
      method: 'POST',
      body: loginBody,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(loginBody),
      }),
    )
    expect(result).toEqual(user)
  })

  it('throws ApiError with normalized fields from JSON error payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            status: 409,
            error: 'Conflict',
            message: 'plan already exists',
            code: 'PLAN_EXISTS',
            path: '/api/daily-plans/generate',
            details: { title: ['must not be blank'] },
          } satisfies ApiErrorResponse),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    )

    await expect(apiRequest('/api/tasks', { method: 'POST', body: {} })).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
      message: 'plan already exists',
      code: 'PLAN_EXISTS',
      details: { title: ['must not be blank'] },
    } satisfies Partial<ApiError>)
  })

  it('throws ApiError for non-JSON error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 401 })),
    )

    await expect(apiRequest('/api/auth/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      message: expect.stringMatching(/401/i),
    })
  })
})

describe('apiRequest CSRF', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.cookie = ''
  })

  it('does not send X-XSRF-TOKEN on GET requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=abc123'

    await apiRequest('/api/auth/me')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-XSRF-TOKEN']).toBeUndefined()
  })

  it('sends X-XSRF-TOKEN from XSRF-TOKEN cookie on POST requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=csrf-token-value'

    const loginBody: LoginRequest = { username: 'user', password: 'secret' }
    await apiRequest('/api/auth/login', {
      method: 'POST',
      body: loginBody,
    })

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers['X-XSRF-TOKEN']).toBe('csrf-token-value')
  })

  it('sends X-XSRF-TOKEN on PUT and DELETE requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(null, { status: 204 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    document.cookie = 'XSRF-TOKEN=mutate-token'

    await apiRequest('/api/tasks/1', { method: 'PUT', body: { title: 'x' } })
    await apiRequest('/api/tasks/1', { method: 'DELETE' })

    for (const [, init] of fetchMock.mock.calls) {
      const headers = (init as RequestInit).headers as Record<string, string>
      expect(headers['X-XSRF-TOKEN']).toBe('mutate-token')
    }
  })
})
