import {
  barPercent,
  dayTotalMinutes,
  savedShortfallMinutes,
  segmentOn,
} from '@/features/horizon/horizonGrid'
import { formatDateLabel, formatDuration } from '@/lib/format'
import type { HorizonResponse } from '@/types/api'

type HorizonDayListProps = {
  horizon: HorizonResponse
  scaleMinutes: number
}

export function HorizonDayList({ horizon, scaleMinutes }: HorizonDayListProps) {
  return (
    <div className="flex flex-col gap-3">
      {horizon.days.map((day, index) => {
        const isSaved = day.kind === 'SAVED'
        const totalMinutes = dayTotalMinutes(horizon.tasks, day.date)
        const shortfallMinutes = isSaved
          ? savedShortfallMinutes(horizon.tasks, day.date)
          : 0
        const items = horizon.tasks.flatMap((task) => {
          const segment = segmentOn(task, day.date)
          return segment != null && segment.minutes > 0
            ? [{ taskId: task.taskId, title: task.title, segment }]
            : []
        })
        const headingId = `horizon-day-${index}`

        return (
          <section
            key={day.date}
            aria-labelledby={headingId}
            className={`rounded-lg border border-border ${
              isSaved ? 'bg-secondary' : 'bg-card'
            }`}
          >
            <header className="flex items-start justify-between gap-3 p-3">
              <div className="space-y-0.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {isSaved ? 'Saved' : 'Forecast'}
                </span>
                <h2 id={headingId} className="text-sm font-semibold">
                  {formatDateLabel(day.date)}
                </h2>
              </div>
              <div className="space-y-0.5 text-right">
                <div className="font-mono text-xs text-muted-foreground">
                  {formatDuration(totalMinutes)}
                </div>
                {shortfallMinutes > 0 ? (
                  <div className="text-xs font-medium text-destructive">
                    Shortfall {formatDuration(shortfallMinutes)}
                  </div>
                ) : null}
              </div>
            </header>
            {items.length > 0 ? (
              <ul className="border-t border-border">
                {items.map((item) => (
                  <li
                    key={item.taskId}
                    className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-t border-border px-3 py-2 first:border-t-0"
                  >
                    <span className="truncate text-sm">{item.title}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatDuration(item.segment.minutes)}
                    </span>
                    <span className="col-span-2 block h-2 rounded-full bg-muted">
                      <span
                        className="block h-2 rounded-full bg-primary"
                        style={{
                          width: `${barPercent(item.segment.minutes, scaleMinutes)}%`,
                        }}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                No work forecast
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}
