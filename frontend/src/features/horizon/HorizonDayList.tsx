import { useState } from 'react'
import { TriangleAlertIcon } from 'lucide-react'

import { DeadlineBadge } from '@/features/horizon/DeadlineBadge'
import {
  barPercent,
  dayTotalMinutes,
  formatDueDateTitle,
  savedShortfallMinutes,
  segmentCellCopy,
  segmentOn,
  upstreamCopy,
  waitingOnCopy,
} from '@/features/horizon/horizonGrid'
import { formatDateLabel, formatDuration } from '@/lib/format'
import type { HorizonResponse } from '@/types/api'

type HorizonDayListProps = {
  horizon: HorizonResponse
  scaleMinutes: number
}

function hasWork(segment: { minutes: number; unplacedReason: string | null }): boolean {
  return segment.minutes > 0 || segment.unplacedReason != null
}

export function HorizonDayList({ horizon, scaleMinutes }: HorizonDayListProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)

  // A blocker can have no qualifying segment, so it has no day row to highlight.
  const displayedTaskIds = new Set<number>()
  for (const task of horizon.tasks) {
    if (horizon.days.some((day) => {
      const segment = segmentOn(task, day.date)
      return segment != null && hasWork(segment)
    })) {
      displayedTaskIds.add(task.taskId)
    }
  }

  const selectedTask =
    horizon.tasks.find((task) => task.taskId === selectedTaskId) ?? null
  const highlightedTaskIds = new Set(
    selectedTask?.waitingOn.map((ref) => ref.taskId) ?? [],
  )
  const missingBlockers = (selectedTask?.waitingOn ?? []).filter(
    (ref) => !displayedTaskIds.has(ref.taskId),
  )

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
          return segment != null && hasWork(segment) ? [{ task, segment }] : []
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
                  <div className="flex items-center justify-end gap-1 text-xs font-medium text-deadline-at-risk">
                    <TriangleAlertIcon className="size-3" aria-hidden="true" />
                    Shortfall {formatDuration(shortfallMinutes)}
                  </div>
                ) : null}
              </div>
            </header>
            {items.length > 0 ? (
              <ul className="border-t border-border">
                {items.map(({ task, segment }) => {
                  const isHighlighted = highlightedTaskIds.has(task.taskId)
                  const isSelected = selectedTaskId === task.taskId
                  const waitingOn = waitingOnCopy(task)
                  const upstream = upstreamCopy(task)
                  const dueTitle = formatDueDateTitle(task.dueDate)

                  return (
                    <li
                      key={task.taskId}
                      data-testid={`horizon-day-task-${task.taskId}-${day.date}`}
                      data-highlighted={isHighlighted ? 'true' : undefined}
                      className={`border-t border-border px-3 py-2 first:border-t-0 ${
                        isHighlighted ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1">
                        <span className="truncate text-sm">{task.title}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {segment.minutes > 0 ? formatDuration(segment.minutes) : null}
                        </span>
                        {dueTitle != null ? (
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {dueTitle}
                          </div>
                        ) : null}
                        {task.deadlineStatus != null ? (
                          <div className="col-span-2">
                            <DeadlineBadge
                              deadlineStatus={task.deadlineStatus}
                              unresolvedEffort={task.unresolvedEffort}
                            />
                          </div>
                        ) : null}
                        {waitingOn != null ? (
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {waitingOn}
                          </div>
                        ) : null}
                        {upstream != null ? (
                          <div className="col-span-2 text-xs text-muted-foreground">
                            {upstream}
                          </div>
                        ) : null}
                        {segmentCellCopy(segment).length > 0 ? (
                          <span className="col-span-2 text-xs text-muted-foreground">
                            {segmentCellCopy(segment).join(' · ')}
                          </span>
                        ) : null}
                        <span className="col-span-2 block h-2 rounded-full bg-muted">
                          <span
                            className="block h-2 rounded-full bg-primary"
                            style={{
                              width: `${barPercent(segment.minutes, scaleMinutes)}%`,
                            }}
                          />
                        </span>
                        {task.waitingOn.length > 0 ? (
                          <button
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`Highlight blockers of ${task.title}`}
                            className="col-span-2 justify-self-start text-xs font-medium underline"
                            onClick={() =>
                              setSelectedTaskId(isSelected ? null : task.taskId)
                            }
                          >
                            {isSelected ? 'Hide blockers' : 'Show blockers'}
                          </button>
                        ) : null}
                        {isSelected && missingBlockers.length > 0 ? (
                          <span className="col-span-2 text-xs text-muted-foreground">
                            Not scheduled this week:{' '}
                            {missingBlockers.map((ref) => ref.title).join(', ')}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  )
                })}
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
