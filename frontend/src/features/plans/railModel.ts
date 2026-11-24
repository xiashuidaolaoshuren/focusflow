import { parseScheduledBlock } from '@/features/plans/blocks'
import { formatClock } from '@/lib/format'
import { toClockMinutes } from '@/lib/planningDate'
import type {
  BlockKind,
  DailyPlanResponse,
  ScheduledBlockResponse,
} from '@/types/api'

export type Density = 'comfortable' | 'compact' | 'mini'

const PX_PER_MINUTE: Record<Density, number> = {
  comfortable: 1.6,
  compact: 1.2,
  mini: 0.6,
}

export type RailBlock = {
  id: number
  kind: BlockKind
  recordable: boolean
  startMinutes: number
  durationMinutes: number
  topPx: number
  heightPx: number
  layout: 'stack' | 'row'
  range: string
  title: string
  sessionLabel: string | null
  label: string
  outcome: OutcomeView | null
  isCurrent: boolean
}

export type OutcomeTone =
  | 'done'
  | 'partly'
  | 'skipped'
  | 'gone'
  | 'log'
  | 'current'
  | 'commitment'

export type OutcomeView = { tone: OutcomeTone; text: string }

const STACK_MIN_HEIGHT_PX = 44
const MIN_BLOCK_PX = 20
const NEAR_NOW_MINUTES = 14

export const KIND_LABELS: Record<BlockKind, string> = {
  WORK: 'Work',
  CADENCE_BREAK: 'Cadence break',
  FIXED_BREAK: 'Fixed break',
  COMMITMENT: 'Commitment',
  BUFFER: 'Trailing buffer',
}

export type Rail = {
  blocks: RailBlock[]
  nowTopPx: number | null
  nowLabel: string | null
  nowMinutes: number | null
  hours: { label: string; topPx: number; nearNow: boolean }[]
  lines: { topPx: number; half: boolean }[]
  peak: { topPx: number; heightPx: number } | null
  /** Where the no-plan card sits: 10 minutes after now, kept inside the window. */
  emptyCardTopPx: number
  totalPx: number
}

function outcomeView(
  block: ScheduledBlockResponse,
  startMinutes: number,
  endMinutes: number,
  nowMinutes: number | null,
): OutcomeView | null {
  if (block.kind === 'COMMITMENT') {
    return { tone: 'commitment', text: 'Unavailable' }
  }
  if (block.kind !== 'WORK') {
    return null
  }
  if (block.displayState === 'NO_LONGER_NEEDED') {
    return { tone: 'gone', text: 'No longer needed' }
  }
  switch (block.outcome) {
    case 'DONE':
      return { tone: 'done', text: 'Done' }
    case 'PARTLY_DONE':
      return {
        tone: 'partly',
        text:
          block.actualMinutes != null
            ? `Partly \u00b7 ${block.actualMinutes} of ${endMinutes - startMinutes}m`
            : 'Partly done',
      }
    case 'SKIPPED':
      return { tone: 'skipped', text: 'Skipped' }
    default:
      break
  }
  if (nowMinutes != null && nowMinutes >= startMinutes && nowMinutes < endMinutes) {
    return {
      tone: 'current',
      text: `In progress · ${Math.ceil(endMinutes - nowMinutes)}m left`,
    }
  }
  if (nowMinutes != null && nowMinutes >= endMinutes) {
    return { tone: 'log', text: 'Log outcome' }
  }
  return null
}

function clockFromMinutes(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mins = String(Math.floor(minutes % 60)).padStart(2, '0')
  return `${hours}:${mins}`
}

export function buildRail(
  plan: Pick<
    DailyPlanResponse, 'composedRail' | 'windowStart' | 'windowEnd' | 'peakStart' | 'peakEnd'
  >,
  nowMinutes: number | null,
  density: Density,
): Rail {
  const ppm = PX_PER_MINUTE[density]
  const windowStart = toClockMinutes(plan.windowStart)
  const windowEnd = toClockMinutes(plan.windowEnd)
  const nowVisible =
    nowMinutes != null && nowMinutes >= windowStart && nowMinutes <= windowEnd

  const hours: Rail['hours'] = []
  for (let m = Math.ceil(windowStart / 60) * 60; m <= windowEnd; m += 60) {
    hours.push({
      label: clockFromMinutes(m),
      topPx: (m - windowStart) * ppm,
      nearNow: nowMinutes != null && Math.abs(m - nowMinutes) < NEAR_NOW_MINUTES,
    })
  }
  const lines: Rail['lines'] = []
  for (let m = windowStart; m <= windowEnd; m += 30) {
    lines.push({ topPx: (m - windowStart) * ppm, half: m % 60 !== 0 })
  }
  const peak =
    plan.peakStart != null && plan.peakEnd != null
      ? {
          topPx: (toClockMinutes(plan.peakStart) - windowStart) * ppm,
          heightPx: (toClockMinutes(plan.peakEnd) - toClockMinutes(plan.peakStart)) * ppm,
        }
      : null

  // A floored block can be taller than its slot; the next block starts below it
  // instead of overprinting it, keeping its own end time.
  let carriedBottomPx: number | null = null

  return {
    hours,
    lines,
    peak,
    totalPx: (windowEnd - windowStart) * ppm,
    emptyCardTopPx:
      (Math.min(Math.max(nowMinutes ?? windowStart, windowStart) + 10, windowEnd - 200) -
        windowStart) *
      ppm,
    nowTopPx: nowVisible ? (nowMinutes - windowStart) * ppm : null,
    nowMinutes: nowVisible ? nowMinutes : null,
    nowLabel: nowVisible ? clockFromMinutes(nowMinutes) : null,
    blocks: plan.composedRail.map((raw) => {
      const block = parseScheduledBlock(raw)
      const start = toClockMinutes(block.startTime)
      const end = toClockMinutes(block.endTime)
      const range = `${formatClock(block.startTime)}\u2013${formatClock(block.endTime)}`
      const title =
        block.kind === 'WORK' ? block.taskSnapshot.title : block.label
      const sessionLabel =
        block.kind === 'WORK' && block.sessionCount > 1
          ? `session ${block.sessionIndex} of ${block.sessionCount}`
          : null
      const outcome = outcomeView(block, start, end, nowMinutes)
      const label = [
        `${KIND_LABELS[block.kind]}: ${title}`,
        range,
        sessionLabel,
        outcome?.text ?? null,
      ]
        .filter((part) => part != null)
        .join(', ')
      // A 5 or 10 minute block would be 4–14px; the floor keeps one line of its title readable.
      const bodyPx = (end - start) * ppm - 2
      const trueTopPx = (start - windowStart) * ppm
      const trueBottomPx = trueTopPx + bodyPx
      const topPx =
        carriedBottomPx != null ? Math.max(trueTopPx, carriedBottomPx) : trueTopPx
      const heightPx = Math.max(MIN_BLOCK_PX, trueBottomPx - topPx)
      carriedBottomPx = topPx + heightPx > trueBottomPx ? topPx + heightPx : null
      return {
        id: block.id,
        kind: block.kind,
        recordable:
          block.kind === 'WORK' &&
          (block.displayState === 'ACTIONABLE' ||
            block.displayState === 'HISTORICAL'),
        startMinutes: start,
        durationMinutes: end - start,
        range,
        title,
        sessionLabel,
        label,
        outcome,
        isCurrent: outcome?.tone === 'current',
        topPx,
        heightPx,
        layout: heightPx >= STACK_MIN_HEIGHT_PX ? 'stack' : 'row',
      }
    }),
  }
}
