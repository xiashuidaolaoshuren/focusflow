import { labelledBlock, toBlockTime } from '@/features/plans/blockFactory'
import type {
  CommitmentResponse,
  DailyPlanResponse,
  SchedulingPreferencesResponse,
} from '@/types/api'

export type PlanlessPreferences = Pick<
  SchedulingPreferencesResponse,
  'workDayStart' | 'workDayEnd' | 'bufferMinutes' | 'fixedBreaks' | 'peakStart' | 'peakEnd'
>

export type PlanlessRailPlan = Pick<
  DailyPlanResponse,
  'composedRail' | 'windowStart' | 'windowEnd' | 'peakStart' | 'peakEnd'
>

function toMinutes(time: string): number {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number)
  return (hours ?? 0) * 60 + (minutes ?? 0)
}

/**
 * The rail a day shows before it has a plan: the work window, fixed breaks, the trailing
 * buffer and the day's commitments. There is no WORK block, because nothing is planned yet.
 */
export function planlessRailPlan(
  preferences: PlanlessPreferences,
  commitments: CommitmentResponse[],
): PlanlessRailPlan {
  const windowStart = toMinutes(preferences.workDayStart)
  const windowEnd = toMinutes(preferences.workDayEnd)

  const blocks = preferences.fixedBreaks.map((fixedBreak, index) =>
    labelledBlock(
      'FIXED_BREAK',
      toMinutes(fixedBreak.startTime),
      toMinutes(fixedBreak.endTime),
      fixedBreak.label.trim() === '' ? 'Fixed break' : fixedBreak.label.trim(),
      index + 1,
    ),
  )
  for (const commitment of commitments) {
    blocks.push(
      // Negative ids keep a commitment from ever sharing an id with a break or the buffer.
      labelledBlock(
        'COMMITMENT',
        toMinutes(commitment.startTime),
        toMinutes(commitment.endTime),
        commitment.title,
        -commitment.id,
      ),
    )
  }
  if (preferences.bufferMinutes > 0) {
    blocks.push(
      labelledBlock(
        'BUFFER',
        windowEnd - preferences.bufferMinutes,
        windowEnd,
        'Trailing buffer',
        0,
      ),
    )
  }
  blocks.sort((left, right) => toMinutes(left.startTime) - toMinutes(right.startTime))

  return {
    composedRail: blocks,
    windowStart: toBlockTime(windowStart),
    windowEnd: toBlockTime(windowEnd),
    peakStart:
      preferences.peakStart == null ? null : toBlockTime(toMinutes(preferences.peakStart)),
    peakEnd: preferences.peakEnd == null ? null : toBlockTime(toMinutes(preferences.peakEnd)),
  }
}
