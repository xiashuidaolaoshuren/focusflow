import { useState } from 'react'
import { useQueries } from '@tanstack/react-query'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPlanById } from '@/features/plans/api'
import { planDetailQueryKey } from '@/features/plans/hooks'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import { useHorizon } from '@/features/horizon/hooks'
import {
  barPercent,
  dashboardHref,
  forecastHeaderCopy,
  formatDueDateTitle,
  HORIZON_PACE_COPY,
  isDueDateColumn,
  longestFullWorkWindow,
  savedConflictCopy,
  segmentAriaLabel,
  segmentCellCopy,
  timeSpanMinutes,
  upstreamCopy,
  waitingOnCopy,
} from '@/features/horizon/horizonGrid'
import type {
  HorizonDayResponse,
  HorizonSegmentResponse,
  HorizonTaskRowResponse,
} from '@/types/api'

function segmentForDate(
  task: HorizonTaskRowResponse,
  date: string,
): HorizonSegmentResponse | undefined {
  return task.segments.find((segment) => segment.date === date)
}

function HorizonPageSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading horizon">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function HorizonPage() {
  const { horizon, isPending, isError, error, refetch } = useHorizon()
  const { preferences } = useSchedulingPreferences()
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<number[]>([])

  const savedPlanIds =
    horizon?.days
      .filter((day) => day.kind === 'SAVED' && day.planId != null)
      .map((day) => day.planId as number) ?? []

  const uniquePlanIds = [...new Set(savedPlanIds)]

  const savedPlanQueries = useQueries({
    queries: uniquePlanIds.map((planId) => ({
      queryKey: planDetailQueryKey(planId),
      queryFn: () => getPlanById(planId),
      enabled: planId > 0,
    })),
  })

  if (isPending || !preferences) {
    return <HorizonPageSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load horizon</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (horizon == null) {
    return null
  }

  const forecastWindowMinutes = timeSpanMinutes(
    preferences.workDayStart,
    preferences.workDayEnd,
  )

  const savedPlanWindows = savedPlanQueries
    .map((query) => query.data)
    .filter((plan): plan is NonNullable<typeof plan> => plan != null)
    .map((plan) => ({
      planId: plan.id,
      windowMinutes: timeSpanMinutes(plan.windowStart, plan.windowEnd),
    }))

  const scaleMinutes = longestFullWorkWindow(
    forecastWindowMinutes,
    savedPlanWindows,
    horizon.days,
  )

  const columnDates = horizon.days.map((day) => day.date)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Horizon</h1>
        <p className="text-sm text-muted-foreground">
          Seven working days from {horizon.currentDate} at {horizon.currentTime}.
        </p>
        <p className="text-sm text-muted-foreground">{HORIZON_PACE_COPY}</p>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-max gap-px rounded-lg border border-border bg-border"
          style={{
            gridTemplateColumns: `minmax(12rem, 16rem) repeat(${horizon.days.length}, minmax(8rem, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-20 bg-background p-2 text-sm font-medium">
            Task
          </div>
          {horizon.days.map((day) => (
            <DayHeader key={day.date} day={day} />
          ))}

          {horizon.tasks.map((task) => (
            <HorizonTaskRow
              key={task.taskId}
              task={task}
              days={horizon.days}
              columnDates={columnDates}
              scaleMinutes={scaleMinutes}
              highlighted={highlightedTaskIds.includes(task.taskId)}
              onHighlightBlockers={() =>
                setHighlightedTaskIds(task.waitingOn.map((ref) => ref.taskId))
              }
              onClearHighlight={() => setHighlightedTaskIds([])}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function DayHeader({ day }: { day: HorizonDayResponse }) {
  const conflictCopy = savedConflictCopy(day)
  return (
    <div
      className={`bg-background p-2 text-center text-sm ${
        day.kind === 'SAVED' ? 'bg-muted/40' : ''
      }`}
    >
      <div className="font-medium">{day.date}</div>
      <Badge variant={day.kind === 'SAVED' ? 'secondary' : 'outline'}>
        {day.kind === 'SAVED' ? 'Saved' : 'Forecast'}
      </Badge>
      {day.kind === 'FORECAST' ? (
        <div className="space-y-1 pt-1 text-left text-xs text-muted-foreground">
          <p>{forecastHeaderCopy()}</p>
          <a className="underline" href={dashboardHref(day.date)}>
            Open {day.date} in the dashboard
          </a>
        </div>
      ) : null}
      {conflictCopy != null ? (
        <p className="pt-1 text-left text-xs text-muted-foreground">
          {conflictCopy}
        </p>
      ) : null}
    </div>
  )
}

type HorizonTaskRowProps = {
  task: HorizonTaskRowResponse
  days: HorizonDayResponse[]
  columnDates: string[]
  scaleMinutes: number
  highlighted: boolean
  onHighlightBlockers: () => void
  onClearHighlight: () => void
}

function HorizonTaskRow({
  task,
  days,
  columnDates,
  scaleMinutes,
  highlighted,
  onHighlightBlockers,
  onClearHighlight,
}: HorizonTaskRowProps) {
  const waitingOn = waitingOnCopy(task)
  const upstream = upstreamCopy(task)

  return (
    <div
      style={{ display: 'contents' }}
      data-testid={`horizon-row-${task.taskId}`}
      data-highlighted={highlighted ? 'true' : undefined}
      onMouseEnter={onHighlightBlockers}
      onMouseLeave={onClearHighlight}
    >
      <div
        className={`sticky left-0 z-10 space-y-1 p-2 text-sm ${
          highlighted ? 'bg-muted' : 'bg-background'
        }`}
      >
        <div className="font-medium">{task.title}</div>
        <div className="text-muted-foreground">
          Due {formatDueDateTitle(task.dueDate)}
        </div>
        {waitingOn != null ? (
          <div className="text-xs text-muted-foreground">{waitingOn}</div>
        ) : null}
        {upstream != null ? (
          <div className="text-xs text-muted-foreground">{upstream}</div>
        ) : null}
      </div>
      {days.map((day) => {
        const segment = segmentForDate(task, day.date)
        const showDueMarker = isDueDateColumn(task.dueDate, columnDates) &&
          task.dueDate === day.date

        return (
          <HorizonSegmentCell
            key={`${task.taskId}-${day.date}`}
            task={task}
            day={day}
            segment={segment}
            scaleMinutes={scaleMinutes}
            showDueMarker={showDueMarker}
            highlighted={highlighted}
          />
        )
      })}
    </div>
  )
}

type HorizonSegmentCellProps = {
  task: HorizonTaskRowResponse
  day: HorizonDayResponse
  segment: HorizonSegmentResponse | undefined
  scaleMinutes: number
  showDueMarker: boolean
  highlighted: boolean
}

function HorizonSegmentCell({
  task,
  day,
  segment,
  scaleMinutes,
  showDueMarker,
  highlighted,
}: HorizonSegmentCellProps) {
  if (segment == null) {
    return (
      <div
        className={`p-2 text-xs text-muted-foreground ${
          highlighted ? 'bg-muted' : 'bg-background'
        }`}
      >
        {showDueMarker ? <span className="font-medium">Due</span> : null}
      </div>
    )
  }

  const copyLines = segmentCellCopy(segment)
  const ariaLabel = segmentAriaLabel(task, segment, day.kind)
  const width = barPercent(segment.minutes, scaleMinutes)

  return (
    <div
      className={`p-2 text-xs ${day.kind === 'SAVED' ? 'bg-muted/20' : 'bg-background'} ${
        highlighted ? 'bg-muted' : ''
      }`}
    >
      {showDueMarker ? (
        <div className="mb-1 font-medium text-primary">Due</div>
      ) : null}
      <div
        tabIndex={0}
        aria-label={ariaLabel}
        className="space-y-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {segment.minutes > 0 ? (
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${width}%` }}
            />
          </div>
        ) : null}
        {copyLines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  )
}
