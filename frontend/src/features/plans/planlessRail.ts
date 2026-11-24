import { labelledBlock, toBlockTime } from '@/features/plans/blockFactory'
import { toClockMinutes } from '@/lib/planningDate'
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


/**
 * The rail a day shows before it has a plan: the work window, fixed breaks, the trailing
 * buffer and the day's commitments. There is no WORK block, because nothing is planned yet.
 */
export function planlessRailPlan(
  preferences: PlanlessPreferences,
  commitments: CommitmentResponse[],
): PlanlessRailPlan {
  const windowStart = toClockMinutes(preferences.workDayStart)
  const windowEnd = toClockMinutes(preferences.workDayEnd)

  const blocks = preferences.fixedBreaks.map((fixedBreak, index) =>
    labelledBlock(
      'FIXED_BREAK',
      toClockMinutes(fixedBreak.startTime),
      toClockMinutes(fixedBreak.endTime),
      fixedBreak.label.trim() === '' ? 'Fixed break' : fixedBreak.label.trim(),
      index + 1,
    ),
  )
  for (const commitment of commitments) {
    blocks.push(
      // Negative ids keep a commitment from ever sharing an id with a break or the buffer.
      labelledBlock(
        'COMMITMENT',
        toClockMinutes(commitment.startTime),
        toClockMinutes(commitment.endTime),
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
  blocks.sort((left, right) => toClockMinutes(left.startTime) - toClockMinutes(right.startTime))

  return {
    composedRail: blocks,
    windowStart: toBlockTime(windowStart),
    windowEnd: toBlockTime(windowEnd),
    peakStart:
      preferences.peakStart == null ? null : toBlockTime(toClockMinutes(preferences.peakStart)),
    peakEnd: preferences.peakEnd == null ? null : toBlockTime(toClockMinutes(preferences.peakEnd)),
  }
}
