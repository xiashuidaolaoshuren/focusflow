import { ApiError } from '@/lib/api'
import type { DailyPlanResponse } from '@/types/api'

export const PLAN_CONFLICT_MESSAGE =
  'Your change was not saved because a newer update was kept. The plan has been refreshed.'

export const REPLAN_LEGACY_MESSAGE =
  'This day already has recorded work, so it cannot be regenerated. Its original scheduling rules were not captured for re-planning; keep recording actuals and the unfinished work carries into another day.'

const REPLAN_ERROR_MESSAGES: Record<string, string> = {
  REPLAN_NOT_TODAY: 'Only today can be re-planned from here.',
  REPLAN_WINDOW_ENDED:
    'The remaining window has already ended, so this day cannot be re-planned.',
  ELAPSED_WORK_UNRESOLVED:
    'Resolve the elapsed sessions first: record what happened, then re-plan.',
}

/**
 * A conflict the client resolves by refetching: another writer changed the same plan or task
 * effort, and the newer server state must win over the in-flight edit.
 */
export function isPlanRefetchConflict(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'PROGRESS_CONFLICT' || error.code === 'PLAN_CHANGED')
  )
}

/** The explanation a failed re-plan shows, keyed by its stable server code. */
export function replanErrorMessage(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null
  }
  if (error.code === 'REPLAN_LEGACY_SNAPSHOT') {
    return REPLAN_LEGACY_MESSAGE
  }
  if (error.code === 'PROGRESS_CONFLICT' || error.code === 'PLAN_CHANGED') {
    return PLAN_CONFLICT_MESSAGE
  }
  if (error.code != null && REPLAN_ERROR_MESSAGES[error.code] != null) {
    return REPLAN_ERROR_MESSAGES[error.code]!
  }
  return error.message
}

/** Mirrors `PlanReplacePreconditions.hasProgress`: any recorded block outcome, in any revision. */
export function planHasProgress(plan: DailyPlanResponse): boolean {
  return plan.revisions.some((revision) =>
    revision.blocks.some((block) => block.outcome != null),
  )
}

/** The highest-numbered revision, which a re-plan must name as the one it replaces. */
export function latestRevisionId(plan: DailyPlanResponse): number | null {
  const latest = [...plan.revisions]
    .sort((left, right) => left.revisionNumber - right.revisionNumber)
    .at(-1)
  return latest?.id ?? null
}
