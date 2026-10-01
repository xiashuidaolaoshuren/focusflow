import type { ApiErrorResponse } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export class ApiError extends Error {
  readonly status: number
  readonly error?: string
  readonly code?: string | null
  readonly path?: string
  readonly details?: Record<string, string[]>
  readonly timestamp?: string

  constructor(body: ApiErrorResponse) {
    super(body.message)
    this.name = 'ApiError'
    this.status = body.status
    this.error = body.error
    this.code = body.code
    this.path = body.path
    this.details = body.details
    this.timestamp = body.timestamp
  }
}

export type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase())
}

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') {
    return undefined
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE_NAME}=([^;]*)`),
  )
  return match ? decodeURIComponent(match[1]) : undefined
}

function resolveUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  return `${API_BASE_URL}${path}`
}

async function normalizeError(response: Response): Promise<ApiError> {
  const contentType = response.headers.get('Content-Type')
  if (contentType?.includes('application/json')) {
    try {
      const data = (await response.json()) as Partial<ApiErrorResponse>
      return new ApiError({
        status: response.status,
        timestamp: data.timestamp,
        error: data.error,
        message:
          data.message ??
          data.error ??
          `Request failed with status ${response.status}`,
        code: data.code,
        path: data.path,
        details: data.details,
      })
    } catch {
      // fall through to generic error
    }
  }

  return new ApiError({
    status: response.status,
    message: `Request failed with status ${response.status}`,
  })
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, headers = {} } = options
  const url = resolveUrl(path)

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { ...headers },
  }

  if (body !== undefined) {
    init.headers = {
      ...init.headers,
      'Content-Type': 'application/json',
    }
    init.body = JSON.stringify(body)
  }

  if (isMutatingMethod(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      init.headers = {
        ...init.headers,
        [CSRF_HEADER_NAME]: csrfToken,
      }
    }
  }

  const response = await fetch(url, init)

  if (!response.ok) {
    throw await normalizeError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const contentType = response.headers.get('Content-Type')
  if (contentType?.includes('application/json')) {
    return (await response.json()) as T
  }

  return undefined as T
}
