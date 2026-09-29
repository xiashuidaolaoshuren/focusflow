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

function blockDurationMinutes(block: ScheduledBlockResponse): number {
  return Math.max(timeToMinutes(block.endTime) - timeToMinutes(block.startTime), 1)
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

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <div
        className="flex flex-col justify-between text-xs text-muted-foreground"
        aria-hidden
      >
        {hourLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div
        className="relative flex min-h-64 flex-col gap-1 rounded-md border border-border bg-muted/20 p-1"
        aria-label={`Schedule from ${formatClock(plan.windowStart)} to ${formatClock(plan.windowEnd)}`}
      >
        {hasPeak ? (
          <div
            role="region"
            aria-label="Peak hours"
            className="pointer-events-none absolute inset-x-1 rounded-sm bg-primary/10"
            style={{
              top: `${((timeToMinutes(plan.peakStart!) - windowStartMinutes) / windowDurationMinutes) * 100}%`,
              height: `${((timeToMinutes(plan.peakEnd!) - timeToMinutes(plan.peakStart!)) / windowDurationMinutes) * 100}%`,
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
            className="relative z-10 rounded-sm border border-border bg-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{
              flexGrow: blockDurationMinutes(block),
              flexBasis: 0,
              minHeight: '1.5rem',
            }}
          >
            <span className="sr-only">{buildBlockLabel(block)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
