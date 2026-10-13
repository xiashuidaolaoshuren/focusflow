/** Frontend API contracts mirrored from Milestone 1 backend DTOs. */

/** Mirrors `com.focusflow.common.error.ApiErrorResponse` */
export type ApiErrorResponse = {
  timestamp?: string
  status: number
  error?: string
  message: string
  code?: string | null
  path?: string
  details?: Record<string, string[]>
  requestId?: string
}

export type LoginRequest = {
  username: string
  password: string
}

export type RegisterRequest = {
  email: string
  username: string
  password: string
}

export type UserResponse = {
  id: number
  email: string
  username: string
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED'

/** Mirrors `com.focusflow.task.dto.TaskLinkResponse` */
export type TaskLinkResponse = {
  taskId: number
  title: string
  status: TaskStatus
}

export type TaskResponse = {
  id: number
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  estimatedMinutes: number | null
  remainingEffortMinutes: number | null
  effortVersion: number
  blockedBy: TaskLinkResponse[]
  blocks: TaskLinkResponse[]
}

export type AddBlockerRequest = {
  blockerTaskId: number
}

export type CreateTaskRequest = {
  title: string
  description?: string | null
  priority?: TaskPriority
  dueDate?: string | null
  estimatedMinutes?: number | null
}

export type UpdateTaskRequest = {
  title: string
  description?: string | null
  priority?: TaskPriority
  status?: TaskStatus
  dueDate?: string | null
  estimatedMinutes?: number | null
  currentDate?: string | null
  remainingEffortMinutes?: number | null
  effortVersion?: number | null
}

export type RemainingEffortRequest = {
  remainingEffortMinutes: number | null
  currentDate: string
  effortVersion: number
}

export type GeneratePlanRequest = {
  planDate: string
  replacePlanId?: number | null
}

/** Mirrors `com.focusflow.commitment.dto.CommitmentResponse` */
export type CommitmentResponse = {
  id: number
  title: string
  commitmentDate: string
  startTime: string
  endTime: string
}

/** Mirrors `com.focusflow.commitment.dto.CommitmentRequest` */
export type CommitmentRequest = {
  title: string
  commitmentDate: string
  startTime: string
  endTime: string
}

/** Mirrors `com.focusflow.preferences.dto.FixedBreakResponse` */
export type FixedBreakResponse = {
  label: string
  startTime: string
  endTime: string
}

/** Mirrors `com.focusflow.preferences.dto.FixedBreakRequest` */
export type FixedBreakRequest = FixedBreakResponse

/** Mirrors `java.time.DayOfWeek` in scheduling preferences DTOs */
export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY'

const DAY_OF_WEEK_ORDER: DayOfWeek[] = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]

export const DAY_OF_WEEK_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday',
  SUNDAY: 'Sunday',
}

export { DAY_OF_WEEK_ORDER }

/** Mirrors `com.focusflow.preferences.dto.SchedulingPreferencesResponse` */
export type SchedulingPreferencesResponse = {
  workDayStart: string
  workDayEnd: string
  cadenceEnabled: boolean
  targetFocusMinutes: number
  breakMinutes: number
  minSessionMinutes: number
  bufferMinutes: number
  peakStart: string | null
  peakEnd: string | null
  fixedBreaks: FixedBreakResponse[]
  workingDays: DayOfWeek[]
  persisted: boolean
}

/** Mirrors `com.focusflow.preferences.dto.SchedulingPreferencesRequest` */
export type SchedulingPreferencesRequest = {
  workDayStart: string
  workDayEnd: string
  cadenceEnabled: boolean
  targetFocusMinutes: number
  breakMinutes: number
  minSessionMinutes: number
  bufferMinutes: number
  peakStart: string | null
  peakEnd: string | null
  fixedBreaks: FixedBreakRequest[]
  workingDays: DayOfWeek[]
}

/** Mirrors `com.focusflow.common.web.PageResponse` */
export type PageResponse<T> = {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

/** Mirrors `com.focusflow.schedule.BlockKind` */
export type BlockKind =
  | 'WORK'
  | 'CADENCE_BREAK'
  | 'FIXED_BREAK'
  | 'COMMITMENT'
  | 'BUFFER'

/** Mirrors `com.focusflow.schedule.UnplacedReason` */
export type UnplacedReason = 'NO_ESTIMATE' | 'OUT_OF_TIME' | 'BLOCKED'

/** Mirrors `com.focusflow.effort.WorkOutcome` */
export type WorkOutcome = 'DONE' | 'PARTLY_DONE' | 'SKIPPED'

/** Mirrors `com.focusflow.plan.BlockDisplayState` */
export type BlockDisplayState =
  | 'ACTIONABLE'
  | 'HISTORICAL'
  | 'SUPERSEDED'
  | 'NO_LONGER_NEEDED'

/** Mirrors `com.focusflow.plan.dto.TaskSnapshotResponse` */
export type TaskSnapshotResponse = {
  sourceTaskId: number
  taskReferenceId: number | null
  title: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  estimatedMinutes: number | null
  capturedRemainingEffortMinutes: number | null
  mustInclude: boolean
  capturedCheckpointId: number | null
  neededForTaskId: number | null
}

type ScheduledBlockFields = {
  id: number
  revisionId: number
  outcome: WorkOutcome | null
  actualMinutes: number | null
  reconciled: boolean
  progressVersion: number
  displayState: BlockDisplayState
}

/** Mirrors `com.focusflow.plan.dto.ScheduledBlockResponse` as discriminated variants. */
export type LabelledBlockKind = 'CADENCE_BREAK' | 'FIXED_BREAK' | 'COMMITMENT' | 'BUFFER'

export type WorkBlockResponse = ScheduledBlockFields & {
  kind: 'WORK'
  startTime: string
  endTime: string
  sessionIndex: number
  sessionCount: number
  taskSnapshot: TaskSnapshotResponse
  label: null
}

export type LabelledBlockResponse = ScheduledBlockFields & {
  kind: LabelledBlockKind
  startTime: string
  endTime: string
  sessionIndex: null
  sessionCount: null
  taskSnapshot: null
  label: string
}

export type ScheduledBlockResponse = WorkBlockResponse | LabelledBlockResponse

/** Mirrors `com.focusflow.plan.dto.UnplacedWorkResponse` */
export type UnplacedWorkResponse = {
  reason: UnplacedReason
  unplacedMinutes: number | null
  taskSnapshot: TaskSnapshotResponse
  blockerSourceTaskIds: number[]
}

/** Mirrors `com.focusflow.plan.dto.PlanRevisionResponse` */
export type PlanRevisionResponse = {
  id: number
  revisionNumber: number
  cutoff: string | null
  freeMinutes: number
  scheduledWorkMinutes: number
  requiredMinutes: number
  requestedBufferMinutes: number
  realizedBufferMinutes: number
  blocks: ScheduledBlockResponse[]
  unplacedWork: UnplacedWorkResponse[]
}

/** Mirrors `com.focusflow.task.dto.UnplannedWorkResponse` */
export type UnplannedWorkResponse = {
  id: number
  sourceTaskId: number
  taskReferenceId: number | null
  workDate: string
  actualMinutes: number
  recordedAt: string
}

/** Mirrors `com.focusflow.task.dto.UnplannedWorkRequest` */
export type UnplannedWorkRequest = {
  taskId: number
  workDate: string
  actualMinutes: number
  currentDate: string
  effortVersion: number
  finish: boolean
  checkpoint: { remainingEffortMinutes: number | null } | null
}

/** Mirrors `com.focusflow.plan.dto.BlockProgressRequest` */
export type BlockProgressRequest = {
  outcome: WorkOutcome
  actualMinutes: number | null
  currentDate: string
  expectedProgressVersion: number
  finish: boolean
  checkpoint: { remainingEffortMinutes: number | null } | null
  cutoff?: string | null
}

/** Mirrors `com.focusflow.plan.dto.BlockProgressResponse` */
export type BlockProgressResponse = {
  task: TaskResponse
  plan: DailyPlanResponse
}

/** Mirrors `com.focusflow.plan.dto.TaskEffortVersion` */
export type TaskEffortVersion = {
  taskId: number
  effortVersion: number
}

/** Mirrors `com.focusflow.plan.dto.ReplanRequest` */
export type ReplanRequest = {
  currentDate: string
  cutoff: string
  expectedRevisionId: number
  effortVersions: TaskEffortVersion[]
}

/** Mirrors `com.focusflow.plan.dto.DailyPlanSummaryResponse` */
export type DailyPlanSummaryResponse = {
  id: number
  planDate: string
  createdAt: string
  scheduledWorkMinutes: number
  workSessionCount: number
  scheduledTaskCount: number
  unplacedWorkCount: number
  hasWarning: boolean
  hasProgress: boolean
  needsRefresh: boolean
}

/** Mirrors `com.focusflow.plan.dto.DailyPlanWarning` */
export type DailyPlanWarning = {
  requiredMinutes: number
  freeMinutes: number
  scheduledWorkMinutes: number
  outOfTimeTasks: {
    sourceTaskId: number
    title: string
    unplacedMinutes: number
  }[]
  unestimatedTasks: {
    sourceTaskId: number
    title: string
  }[]
  blockedTasks: {
    sourceTaskId: number
    title: string
    blockerSourceTaskIds: number[]
  }[]
}

/** Mirrors `com.focusflow.plan.dto.DailyPlanResponse` */
export type DailyPlanResponse = {
  id: number
  planDate: string
  createdAt: string
  windowStart: string
  windowEnd: string
  peakStart: string | null
  peakEnd: string | null
  freeMinutes: number
  scheduledWorkMinutes: number
  requiredMinutes: number
  requestedBufferMinutes: number
  realizedBufferMinutes: number
  warning: DailyPlanWarning | null
  blocks: ScheduledBlockResponse[]
  unplacedWork: UnplacedWorkResponse[]
  needsRefresh: boolean
  knownActualMinutes: number
  missingActualCount: number
  revisions: PlanRevisionResponse[]
  composedRail: ScheduledBlockResponse[]
  offRailEarlyCompletions: ScheduledBlockResponse[]
  unplannedWork: UnplannedWorkResponse[]
}
