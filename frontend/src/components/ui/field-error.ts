import { ApiError } from "@/lib/api"

/** The first server-side message for a named field, when the error carries field details. */
export function getFieldError(
  error: unknown,
  fieldName: string,
): string | undefined {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined
  }
  return error.details[fieldName]?.[0]
}
