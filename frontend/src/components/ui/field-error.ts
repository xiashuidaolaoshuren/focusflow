import { ApiError } from "@/lib/api"

/** Spring writes list indexes as `items[0].label`; form paths write `items.0.label`. */
function normalizeDetailKey(key: string): string {
  return key.replace(/\[(\d+)\]/g, '.$1')
}

/** The first server-side message for a named field, when the error carries field details. */
export function getFieldError(
  error: unknown,
  fieldName: string,
): string | undefined {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined
  }
  const exact = error.details[fieldName]?.[0]
  if (exact !== undefined) {
    return exact
  }
  const wanted = normalizeDetailKey(fieldName)
  const match = Object.entries(error.details).find(
    ([key]) => normalizeDetailKey(key) === wanted,
  )
  return match?.[1]?.[0]
}
