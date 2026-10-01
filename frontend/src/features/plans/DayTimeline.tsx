import type { DailyPlanResponse, ScheduledBlockResponse } from '@/types/api'

type DayTimelineProps = {
  plan: Pick<
    DailyPlanResponse,
    'windowStart' | 'windowEnd' | 'peakStart' | 'peakEnd' | 'blocks'
  >
}

const KIND_LABELS: Record<ScheduledBlockResponse['kind'], string> = {
  WORK: 'Work',
  CADENCE_BREAK: 'Cadence break',
  FIXED_BREAK: 'Fixed break',
  COMMITMENT: 'Commitment',
  BUFFER: 'Buffer',
}

const KIND_STYLES: Record<ScheduledBlockResponse['kind'], string> = {
  WORK: 'border-primary/50 bg-primary/15',
  CADENCE_BREAK: 'border-border bg-muted border-dashed',
  FIXED_BREAK: 'border-border bg-muted border-dotted',
  COMMITMENT: 'border-destructive/40 bg-muted border-dashed',
  BUFFER: 'border-border bg-transparent border-dashed',
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return hours! * 60 + minutes!
}

function formatClock(time: string): string {
  return time.slice(0, 5)
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatClock(startTime)}–${formatClock(endTime)}`
}

function buildBlockLabel(block: ScheduledBlockResponse): string {
  const timeRange = formatTimeRange(block.startTime, block.endTime)
  const kindLabel = KIND_LABELS[block.kind]

  if (block.kind === 'WORK' && block.taskSnapshot != null) {
    const sessionLabel =
      block.sessionIndex != null && block.sessionCount != null
        ? `, session ${block.sessionIndex} of ${block.sessionCount}`
        : ''
    return `${kindLabel}: ${block.taskSnapshot.title}${sessionLabel}, ${timeRange}`
  }

  return `${kindLabel}: ${block.label ?? kindLabel}, ${timeRange}`
}

function listHourLabels(windowStart: string, windowEnd: string): string[] {
  const startHour = Math.floor(timeToMinutes(windowStart) / 60)
  const endHour = Math.ceil(timeToMinutes(windowEnd) / 60)
  const labels: string[] = []

  for (let hour = startHour; hour <= endHour; hour += 1) {
    labels.push(`${String(hour).padStart(2, '0')}:00`)
  }

  return labels
}

export function DayTimeline({ plan }: DayTimelineProps) {
  const windowStartMinutes = timeToMinutes(plan.windowStart)
  const windowEndMinutes = timeToMinutes(plan.windowEnd)
  const windowDurationMinutes = Math.max(windowEndMinutes - windowStartMinutes, 1)
  const hourLabels = listHourLabels(plan.windowStart, plan.windowEnd)
  const hasPeak = plan.peakStart != null && plan.peakEnd != null

  function percentFromWindowStart(minutesFromWindowStart: number): string {
    return `${(minutesFromWindowStart / windowDurationMinutes) * 100}%`
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <div className="relative text-xs text-muted-foreground" aria-hidden>
        {hourLabels.map((label, index) => {
          const hourMinutes = (Math.floor(timeToMinutes(plan.windowStart) / 60) + index) * 60
          return (
            <span
              key={label}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: percentFromWindowStart(hourMinutes - windowStartMinutes) }}
            >
              {label}
            </span>
          )
        })}
      </div>

      <div
        className="relative min-h-64 rounded-md border border-border bg-muted/20"
        aria-label={`Schedule from ${formatClock(plan.windowStart)} to ${formatClock(plan.windowEnd)}`}
      >
        {hasPeak ? (
          <div
            role="region"
            aria-label="Peak hours"
            className="pointer-events-none absolute inset-x-0 rounded-sm bg-primary/10"
            style={{
              top: percentFromWindowStart(timeToMinutes(plan.peakStart!) - windowStartMinutes),
              height: percentFromWindowStart(
                timeToMinutes(plan.peakEnd!) - timeToMinutes(plan.peakStart!),
              ),
            }}
          />
        ) : null}

        {plan.blocks.map((block, index) => (
          <div
            key={`${block.kind}-${block.startTime}-${index}`}
            role="button"
            tabIndex={0}
            data-kind={block.kind}
            aria-label={buildBlockLabel(block)}
            title={buildBlockLabel(block)}
            className={`absolute inset-x-1 z-10 overflow-hidden rounded-sm border px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring ${KIND_STYLES[block.kind]}`}
            style={{
              top: percentFromWindowStart(timeToMinutes(block.startTime) - windowStartMinutes),
              height: percentFromWindowStart(
                Math.max(timeToMinutes(block.endTime) - timeToMinutes(block.startTime), 0),
              ),
            }}
          >
            <span className="sr-only">{buildBlockLabel(block)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}