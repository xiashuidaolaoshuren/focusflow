import type { ApiErrorResponse } from '@/types/api'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''
const CSRF_COOKIE_NAME = 'XSRF-TOKEN'
const CSRF_HEADER_NAME = 'X-XSRF-TOKEN'
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const REQUEST_TIMEOUT_MS = 15_000

let unauthorizedHandler: (() => void) | undefined

/** Registers the single 401 listener. Replaces any previous handler. Returns unsubscribe. */
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler
  return () => {
    if (unauthorizedHandler === handler) {
      unauthorizedHandler = undefined
    }
  }
}

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
    if (body.error !== undefined) {
      this.error = body.error
    }
    if (body.code !== undefined) {
      this.code = body.code
    }
    if (body.path !== undefined) {
      this.path = body.path
    }
    if (body.details !== undefined) {
      this.details = body.details
    }
    if (body.timestamp !== undefined) {
      this.timestamp = body.timestamp
    }
  }
}

export type ApiRequestOptions = {
  method?: string
  body?: unknown
  headers?: Record<string, string>
  signal?: AbortSignal
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
  const raw = match?.[1]
  return raw !== undefined ? decodeURIComponent(raw) : undefined
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
      const message =
        data.message ??
        data.error ??
        `Request failed with status ${response.status}`
      const body: ApiErrorResponse = { status: response.status, message }
      if (data.timestamp !== undefined) {
        body.timestamp = data.timestamp
      }
      if (data.error !== undefined) {
        body.error = data.error
      }
      if (data.code !== undefined) {
        body.code = data.code
      }
      if (data.path !== undefined) {
        body.path = data.path
      }
      if (data.details !== undefined) {
        body.details = data.details
      }
      return new ApiError(body)
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
  const { method = 'GET', body, headers = {}, signal } = options
  const url = resolveUrl(path)

  const controller = new AbortController()
  let timedOut = false
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  if (signal?.aborted) {
    controller.abort()
  } else {
    signal?.addEventListener('abort', onCallerAbort, { once: true })
  }

  const init: RequestInit = {
    method,
    credentials: 'include',
    headers: { ...headers },
    signal: controller.signal,
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

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (timedOut) {
      throw new ApiError({
        status: 408,
        message: 'Request timed out',
      })
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
    signal?.removeEventListener('abort', onCallerAbort)
  }

  if (!response.ok) {
    if (response.status === 401) {
      unauthorizedHandler?.()
    }
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
