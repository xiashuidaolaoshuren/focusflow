export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isValidPlanningDate(value: string | null): value is string {
  if (value == null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const parsed = Date.parse(`${value}T00:00:00`)
  return !Number.isNaN(parsed)
}

export function resolvePlanningDate(
  searchParam: string | null,
  now = new Date(),
): string {
  if (isValidPlanningDate(searchParam)) {
    return searchParam
  }

  return getLocalDateString(now)
}
