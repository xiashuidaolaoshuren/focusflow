import type {
  DailyPlanResponse,
  DailyPlanSummaryResponse,
  PlanRevisionResponse,
  TaskSnapshotResponse,
  WorkBlockResponse,
} from '@/types/api'

export const sampleTaskSnapshot: TaskSnapshotResponse = {
  sourceTaskId: 10,
  taskReferenceId: 10,
  title: 'Write tests',
  priority: 'HIGH',
  status: 'OPEN',
  dueDate: '2026-06-15',
  estimatedMinutes: 45,
  capturedRemainingEffortMinutes: 45,
  mustInclude: true,
}

export const sampleWorkBlock: WorkBlockResponse = {
  kind: 'WORK',
  startTime: '09:00:00',
  endTime: '09:45:00',
  sessionIndex: 1,
  sessionCount: 1,
  taskSnapshot: sampleTaskSnapshot,
  label: null,
  id: 100,
  revisionId: 1,
  outcome: null,
  actualMinutes: null,
  reconciled: false,
  progressVersion: 0,
  displayState: 'ACTIONABLE',
}

export const sampleRevision: PlanRevisionResponse = {
  id: 1,
  revisionNumber: 1,
  cutoff: null,
  freeMinutes: 480,
  scheduledWorkMinutes: 45,
  requiredMinutes: 45,
  requestedBufferMinutes: 15,
  realizedBufferMinutes: 15,
  blocks: [sampleWorkBlock],
  unplacedWork: [],
}

export const samplePlan: DailyPlanResponse = {
  id: 1,
  planDate: '2026-06-15',
  createdAt: '2026-06-15T09:00:00Z',
  windowStart: '09:00:00',
  windowEnd: '18:00:00',
  peakStart: '10:00:00',
  peakEnd: '12:00:00',
  freeMinutes: 480,
  scheduledWorkMinutes: 45,
  requiredMinutes: 45,
  requestedBufferMinutes: 15,
  realizedBufferMinutes: 15,
  warning: null,
  blocks: [sampleWorkBlock],
  unplacedWork: [],
  needsRefresh: false,
  knownActualMinutes: 0,
  missingActualCount: 0,
  revisions: [sampleRevision],
  composedRail: [sampleWorkBlock],
  offRailEarlyCompletions: [],
  unplannedWork: [],
}

export const progressPlan: DailyPlanResponse = {
  ...samplePlan,
  id: 5,
  planDate: '2026-06-17',
  createdAt: '2026-06-17T09:00:00Z',
  needsRefresh: true,
  knownActualMinutes: 35,
  missingActualCount: 1,
  blocks: [{ ...sampleWorkBlock, outcome: 'DONE', actualMinutes: 35, progressVersion: 1 }],
  revisions: [
    {
      ...sampleRevision,
      blocks: [{ ...sampleWorkBlock, outcome: 'DONE', actualMinutes: 35, progressVersion: 1 }],
    },
  ],
  composedRail: [
    { ...sampleWorkBlock, outcome: 'DONE', actualMinutes: 35, progressVersion: 1 },
  ],
  offRailEarlyCompletions: [
    {
      ...sampleWorkBlock,
      startTime: '15:00:00',
      endTime: '15:30:00',
      outcome: 'DONE',
      actualMinutes: null,
      progressVersion: 1,
      displayState: 'HISTORICAL',
    },
  ],
  unplannedWork: [
    {
      id: 900,
      sourceTaskId: 10,
      taskReferenceId: 10,
      workDate: '2026-06-17',
      actualMinutes: 20,
      recordedAt: '2026-06-17T11:00:00Z',
    },
  ],
}

export const warningPlan: DailyPlanResponse = {
  ...samplePlan,
  id: 2,
  planDate: '2026-06-16',
  createdAt: '2026-06-16T09:00:00Z',
  freeMinutes: 120,
  scheduledWorkMinutes: 30,
  requiredMinutes: 180,
  requestedBufferMinutes: 15,
  realizedBufferMinutes: 15,
  warning: {
    requiredMinutes: 180,
    freeMinutes: 120,
    scheduledWorkMinutes: 30,
    outOfTimeTasks: [
      {
        sourceTaskId: 10,
        title: 'Write tests',
        unplacedMinutes: 60,
      },
    ],
    unestimatedTasks: [{ sourceTaskId: 11, title: 'Tidy up' }],
  },
  blocks: [sampleWorkBlock],
  unplacedWork: [],
}

export const reducedBufferPlan: DailyPlanResponse = {
  ...samplePlan,
  id: 3,
  requestedBufferMinutes: 15,
  realizedBufferMinutes: 5,
}

export const unplacedPlan: DailyPlanResponse = {
  ...samplePlan,
  id: 4,
  unplacedWork: [
    {
      reason: 'NO_ESTIMATE',
      unplacedMinutes: null,
      taskSnapshot: {
        ...sampleTaskSnapshot,
        sourceTaskId: 12,
        title: 'Optional unestimated',
        estimatedMinutes: null,
        mustInclude: false,
      },
    },
    {
      reason: 'OUT_OF_TIME',
      unplacedMinutes: 30,
      taskSnapshot: {
        ...sampleTaskSnapshot,
        sourceTaskId: 13,
        title: 'Overflow task',
        mustInclude: false,
      },
    },
  ],
}

export const samplePlanSummary: DailyPlanSummaryResponse = {
  id: 1,
  planDate: '2026-06-14',
  createdAt: '2026-06-14T09:00:00Z',
  scheduledWorkMinutes: 120,
  workSessionCount: 3,
  scheduledTaskCount: 2,
  unplacedWorkCount: 1,
  hasWarning: true,
  hasProgress: false,
  needsRefresh: false,
}
