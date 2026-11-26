import { ApiError } from '@/lib/api'

const DEPENDENCY_COPY: Record<string, string> = {
  DEPENDENCY_CYCLE:
    'That link would create a cycle: this task already blocks the one you chose, directly or through another task.',
  SELF_DEPENDENCY: 'A task cannot block itself.',
  DEPENDENCY_EXISTS: 'That task is already a blocker.',
}

/** The plain-language explanation for a rejected blocker link, or null for other errors. */
export function dependencyErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError) || error.code == null) {
    return null
  }
  return DEPENDENCY_COPY[error.code] ?? null
}
