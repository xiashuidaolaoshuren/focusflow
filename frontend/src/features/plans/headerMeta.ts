export type HeaderMetaPart = 'schedule' | 'replanned' | 'noPlan' | 'past' | 'upcoming'

export type HeaderMetaInput = {
  hasPreferences: boolean
  hasPlan: boolean
  replayedAt: string | null
  planDate: string
  today: string
}

/**
 * The facts under the Today title, in reading order. Only the parts that apply are listed,
 * so the view can join them with separators without ever leading or trailing one.
 */
export function headerMetaParts({
  hasPreferences,
  hasPlan,
  replayedAt,
  planDate,
  today,
}: HeaderMetaInput): HeaderMetaPart[] {
  const parts: HeaderMetaPart[] = []
  if (hasPreferences) {
    parts.push('schedule')
  }
  if (!hasPlan) {
    parts.push('noPlan')
  } else if (replayedAt != null) {
    parts.push('replanned')
  }
  if (planDate < today) {
    parts.push('past')
  } else if (planDate > today) {
    parts.push('upcoming')
  }
  return parts
}
