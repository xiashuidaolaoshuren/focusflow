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

export type TaskResponse = {
  id: number
  title: string
  description: string | null
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  estimatedMinutes: number | null
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
export type UnplacedReason = 'NO_ESTIMATE' | 'OUT_OF_TIME'

/** Mirrors `com.focusflow.plan.dto.TaskSnapshotResponse` */
export type TaskSnapshotResponse = {
  sourceTaskId: number
  taskReferenceId: number | null
  title: string
  priority: TaskPriority
  status: TaskStatus
  dueDate: string | null
  estimatedMinutes: number | null
  mustInclude: boolean
}

/** Mirrors `com.focusflow.plan.dto.ScheduledBlockResponse` */
export type ScheduledBlockResponse = {
  kind: BlockKind
  startTime: string
  endTime: string
  sessionIndex: number | null
  sessionCount: number | null
  taskSnapshot: TaskSnapshotResponse | null
  label: string | null
}

/** Mirrors `com.focusflow.plan.dto.UnplacedWorkResponse` */
export type UnplacedWorkResponse = {
  reason: UnplacedReason
  unplacedMinutes: number | null
  taskSnapshot: TaskSnapshotResponse
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
}
