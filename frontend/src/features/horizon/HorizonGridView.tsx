import { useState } from 'react'
import {
  ArrowRightIcon,
  CalendarIcon,
  CircleHelpIcon,
  OctagonAlertIcon,
  TriangleAlertIcon,
} from 'lucide-react'

import {
  barPercent,
  deadlineBadgeLabel,
  dayTotalMinutes,
  type DueMarker,
  dueMarker,
  forecastHeaderCopy,
  formatDueDateTitle,
  savedConflictCopy,
  savedShortfallMinutes,
  segmentAriaLabel,
  segmentCellCopy,
  todayHref,
  upstreamCopy,
  waitingOnCopy,
} from '@/features/horizon/horizonGrid'
import { formatDateLabel, formatDuration } from '@/lib/format'
import type {
  HorizonDayResponse,
  HorizonResponse,
  HorizonSegmentResponse,
  HorizonTaskRowResponse,
} from '@/types/api'

type HorizonGridProps = {
  horizon: HorizonResponse
  scaleMinutes: number
}

function segmentForDate(
  task: HorizonTaskRowResponse,
  date: string,
): HorizonSegmentResponse | undefined {
  return task.segments.find((segment) => segment.date === date)
}

export function HorizonGridView({ horizon, scaleMinutes }: HorizonGridProps) {
  const [highlightedTaskIds, setHighlightedTaskIds] = useState<number[]>([])
  const columnDates = horizon.days.map((day) => day.date)

  return (
    <section aria-label="Horizon grid" className="overflow-x-auto">
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
          <DayHeader
            key={day.date}
            day={day}
            totalMinutes={dayTotalMinutes(horizon.tasks, day.date)}
            shortfallMinutes={savedShortfallMinutes(horizon.tasks, day.date)}
          />
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
    </section>
  )
}

function DayHeader({
  day,
  totalMinutes,
  shortfallMinutes,
}: {
  day: HorizonDayResponse
  totalMinutes: number
  shortfallMinutes: number
}) {
  const conflictCopy = savedConflictCopy(day)
  const isSaved = day.kind === 'SAVED'
  return (
    <div
      className={`space-y-1 p-2 text-left text-sm ${
        isSaved ? 'bg-secondary' : 'bg-background'
      }`}
    >
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {isSaved ? 'Saved' : 'Forecast'}
      </span>
      <div className="font-semibold">{formatDateLabel(day.date)}</div>
      <div className="font-mono text-xs text-muted-foreground">
        {formatDuration(totalMinutes)}
      </div>
      {isSaved && shortfallMinutes > 0 ? (
        <div className="text-xs font-medium text-destructive">
          Shortfall {formatDuration(shortfallMinutes)}
        </div>
      ) : null}
      {day.kind === 'FORECAST' ? (
        <div className="space-y-1 pt-1 text-left text-xs text-muted-foreground">
          <p>{forecastHeaderCopy()}</p>
          <a className="underline" href={todayHref(day.date)}>
            Open in Today
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

const DEADLINE_GLYPHS = {
  AT_RISK: { Icon: TriangleAlertIcon, tone: 'text-deadline-at-risk' },
  OVERDUE: { Icon: OctagonAlertIcon, tone: 'text-deadline-overdue' },
  CANNOT_FORECAST: { Icon: CircleHelpIcon, tone: 'text-deadline-unknown' },
  BEYOND_HORIZON: { Icon: ArrowRightIcon, tone: 'text-deadline-unknown' },
} as const

function DeadlineForecastBadge({ task }: { task: HorizonTaskRowResponse }) {
  const status = task.deadlineStatus
  if (status == null || !(status in DEADLINE_GLYPHS)) {
    return null
  }
  const key = status as keyof typeof DEADLINE_GLYPHS
  const { Icon, tone } = DEADLINE_GLYPHS[key]
  const label = deadlineBadgeLabel(status, task.unresolvedEffort)
  if (label == null) {
    return null
  }
  return (
    <span
      data-deadline={status}
      className={`inline-flex items-center gap-1 text-xs font-medium ${tone}`}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
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
  const rowMarker = dueMarker(task.dueDate, columnDates)

  return (
    <div
      style={{ display: 'contents' }}
      data-testid={`horizon-row-${task.taskId}`}
      data-highlighted={highlighted ? 'true' : undefined}
      onMouseEnter={onHighlightBlockers}
      onMouseLeave={onClearHighlight}
    >
      <div
        tabIndex={0}
        onFocus={onHighlightBlockers}
        onBlur={onClearHighlight}
        className={`sticky left-0 z-10 space-y-1 rounded-sm p-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          highlighted ? 'bg-muted' : 'bg-background'
        }`}
      >
        <div className="font-medium">{task.title}</div>
        <div className="text-muted-foreground">
          Due {formatDueDateTitle(task.dueDate)}
        </div>
        <DeadlineForecastBadge task={task} />
        {waitingOn != null ? (
          <div className="text-xs text-muted-foreground">{waitingOn}</div>
        ) : null}
        {upstream != null ? (
          <div className="text-xs text-muted-foreground">{upstream}</div>
        ) : null}
      </div>
      {days.map((day) => {
        const segment = segmentForDate(task, day.date)
        const marker =
          rowMarker != null && rowMarker.columnDate === day.date ? rowMarker : null

        return (
          <HorizonSegmentCell
            key={`${task.taskId}-${day.date}`}
            task={task}
            day={day}
            segment={segment}
            scaleMinutes={scaleMinutes}
            marker={marker}
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
  marker: DueMarker | null
  highlighted: boolean
}

function DueMarkerLabel({
  marker,
  dueDate,
}: {
  marker: DueMarker
  dueDate: string
}) {
  return (
    <span
      data-due-marker={marker.placement}
      title={`Due ${formatDateLabel(dueDate)}`}
      className={`inline-flex items-center gap-1 text-xs font-medium text-foreground ${
        marker.placement === 'edge' ? 'float-right' : ''
      }`}
    >
      <CalendarIcon className="size-3" aria-hidden="true" />
      {marker.label}
    </span>
  )
}

function HorizonSegmentCell({
  task,
  day,
  segment,
  scaleMinutes,
  marker,
  highlighted,
}: HorizonSegmentCellProps) {
  if (segment == null) {
    return (
      <div
        className={`p-2 text-xs text-muted-foreground ${
          highlighted ? 'bg-muted' : 'bg-background'
        }`}
      >
        {marker != null && task.dueDate != null ? (
          <DueMarkerLabel marker={marker} dueDate={task.dueDate} />
        ) : null}
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
      {marker != null && task.dueDate != null ? (
        <div className="mb-1">
          <DueMarkerLabel marker={marker} dueDate={task.dueDate} />
        </div>
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
