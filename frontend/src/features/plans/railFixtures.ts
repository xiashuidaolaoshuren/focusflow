import { sampleTaskSnapshot, samplePlan } from '@/features/plans/planFixtures'
import type {
  DailyPlanResponse,
  LabelledBlockKind,
  ScheduledBlockResponse,
  WorkBlockResponse,
} from '@/types/api'

const common = {
  revisionId: 1,
  outcome: null,
  actualMinutes: null,
  reconciled: false,
  progressVersion: 0,
  displayState: 'ACTIONABLE',
} as const

function labelled(
  id: number,
  kind: LabelledBlockKind,
  startTime: string,
  endTime: string,
  label: string,
): ScheduledBlockResponse {
  return {
    ...common,
    id,
    kind,
    startTime,
    endTime,
    sessionIndex: null,
    sessionCount: null,
    taskSnapshot: null,
    label,
  }
}

const workBlock: WorkBlockResponse = {
  ...common,
  id: 201,
  kind: 'WORK',
  startTime: '09:00:00',
  endTime: '09:50:00',
  sessionIndex: 2,
  sessionCount: 3,
  taskSnapshot: { ...sampleTaskSnapshot, title: 'Write report' },
  label: null,
}

/** One block of every kind on a 09:00-18:00 day. */
export const railTestPlan: DailyPlanResponse = {
  ...samplePlan,
  windowStart: '09:00:00',
  windowEnd: '18:00:00',
  peakStart: '09:30:00',
  peakEnd: '12:00:00',
  composedRail: [
    workBlock,
    labelled(202, 'CADENCE_BREAK', '09:50:00', '10:00:00', 'Cadence break'),
    labelled(203, 'FIXED_BREAK', '12:00:00', '13:00:00', 'Lunch'),
    labelled(204, 'COMMITMENT', '14:00:00', '15:00:00', 'Dentist'),
    labelled(205, 'BUFFER', '17:30:00', '18:00:00', 'Trailing buffer'),
  ],
}
