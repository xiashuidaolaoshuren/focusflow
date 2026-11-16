import {
  ArrowRightIcon,
  CircleHelpIcon,
  CheckIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import { deadlineBadgeLabel } from '@/features/horizon/horizonGrid'
import type { DeadlineStatus, HorizonTaskRowResponse } from '@/types/api'

const DEADLINE_GLYPHS = {
  ON_TRACK: { Icon: CheckIcon, tone: 'text-deadline-on-track' },
  AT_RISK: { Icon: TriangleAlertIcon, tone: 'text-deadline-at-risk' },
  OVERDUE: { Icon: OctagonAlertIcon, tone: 'text-deadline-overdue' },
  CANNOT_FORECAST: { Icon: CircleHelpIcon, tone: 'text-deadline-unknown' },
  BEYOND_HORIZON: { Icon: ArrowRightIcon, tone: 'text-deadline-unknown' },
} as const

type DeadlineBadgeProps = {
  deadlineStatus: HorizonTaskRowResponse['deadlineStatus']
  unresolvedEffort: HorizonTaskRowResponse['unresolvedEffort']
  /** Appended after the label, e.g. the due day. */
  suffix?: string | undefined
}

/** Every deadline state with its glyph and word, for the ⓘ legend. */
export function DeadlineLegend() {
  return (
    <ul className="grid gap-2 text-sm">
      {(Object.keys(DEADLINE_GLYPHS) as Array<keyof typeof DEADLINE_GLYPHS>).map((status) => {
        const { Icon, tone } = DEADLINE_GLYPHS[status]
        return (
          <li key={status} className="flex items-center gap-2">
            <span className={`inline-flex ${tone}`}>
              <Icon className="size-3.5" aria-hidden="true" />
            </span>
            <span>{deadlineBadgeLabel(status as DeadlineStatus, [])}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function DeadlineBadge({
  deadlineStatus,
  unresolvedEffort,
  suffix,
}: DeadlineBadgeProps) {
  if (deadlineStatus == null || !(deadlineStatus in DEADLINE_GLYPHS)) {
    return null
  }
  const key = deadlineStatus as keyof typeof DEADLINE_GLYPHS
  const { Icon, tone } = DEADLINE_GLYPHS[key]
  const label = deadlineBadgeLabel(deadlineStatus, unresolvedEffort)
  if (label == null) {
    return null
  }
  return (
    <span
      data-deadline={deadlineStatus}
      className={`inline-flex h-5 items-center gap-1 rounded-sm border border-border bg-card px-1.5 text-xs font-medium ${tone}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {suffix ? `${label} · ${suffix}` : label}
    </span>
  )
}
