/** Frontend API contracts mirrored from Milestone 1 backend DTOs. */

/** Mirrors `com.focusflow.common.error.ApiErrorResponse` */
export type ApiErrorResponse = {
  timestamp?: string
  status: number
  error?: string
  message: string
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
  availableMinutes: number
  planDate?: string | null
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

/** Mirrors `com.focusflow.plan.dto.DailyPlanSummaryResponse` */
export type DailyPlanSummaryResponse = {
  id: number
  planDate: string
  createdAt: string
  itemCount: number
  hasWarning: boolean
  availableMinutes: number | null
}

export type DailyPlanItemResponse = {
  position: number
  task: TaskResponse
}

export type DailyPlanWarningTask = {
  taskId: number
  title: string
}

export type DailyPlanWarningEstimatedTask = DailyPlanWarningTask & {
  estimatedMinutes: number
}

export type DailyPlanWarning = {
  minimumAvailableMinutes: number
  estimatedTasks: DailyPlanWarningEstimatedTask[]
  unestimatedTasks: DailyPlanWarningTask[]
}

export type DailyPlanResponse = {
  id: number
  planDate: string
  createdAt: string
  availableMinutes: number | null
  warning: DailyPlanWarning | null
  items: DailyPlanItemResponse[]
}
