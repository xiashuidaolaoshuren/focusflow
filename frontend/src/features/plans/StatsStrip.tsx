import { TriangleAlertIcon } from 'lucide-react'

import type { TodayStats } from '@/features/plans/todayStats'
import { formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const ITEMS = [
  { key: 'planned', label: 'Planned focus' },
  { key: 'done', label: 'Done' },
  { key: 'left', label: 'Left today' },
  { key: 'shortfall', label: 'Shortfall' },
] as const

/** The 2 × 2 mobile layout drops the vertical rule on the third cell and adds the top rules. */
const CELL_BORDERS = [
  '',
  'border-l',
  'border-t sm:border-t-0 sm:border-l',
  'border-l border-t sm:border-t-0',
]

type StatsStripProps = {
  stats: TodayStats | null
}

/** The four figures that describe the day. With no plan they read as em dashes. */
export function StatsStrip({ stats }: StatsStripProps) {
  return (
    <section
      aria-label="Today at a glance"
      className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4"
    >
      {ITEMS.map((item, index) => {
        const value = stats?.[item.key]
        const warn = item.key === 'shortfall' && value != null && value > 0
        return (
          <div
            key={item.key}
            className={cn(
              'flex flex-col gap-0.5 border-border px-4 py-3',
              CELL_BORDERS[index],
            )}
          >
            <span
              className={cn(
                'flex items-center gap-1.5 font-mono text-lg leading-7 font-medium tracking-[-0.01em] whitespace-nowrap',
                warn ? 'text-deadline-at-risk' : null,
              )}
            >
              {warn ? (
                <TriangleAlertIcon className="size-4" aria-hidden="true" />
              ) : null}
              {value == null ? '—' : formatDuration(value)}
            </span>
            <span className="text-xs leading-4 tracking-[0.01em] text-muted-foreground">
              {item.label}
            </span>
          </div>
        )
      })}
    </section>
  )
}
