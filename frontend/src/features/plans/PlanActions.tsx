import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCwIcon, RotateCcwIcon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useGeneratePlan } from '@/features/plans/hooks'
import {
  PLAN_CONFLICT_MESSAGE,
  replanErrorMessage,
} from '@/features/plans/planConflicts'
import { actionVisibility } from '@/features/plans/planActionRules'
import { plansByDateQueryPrefix } from '@/lib/query'
import { ApiError } from '@/lib/api'
import { getLocalDateString } from '@/lib/planningDate'
import type { DailyPlanResponse } from '@/types/api'

const STALE_PLAN_CODES = new Set([
  'PLAN_EXISTS',
  'PLAN_CHANGED',
  'PLAN_HAS_PROGRESS',
])

/** A 409 that means the client's copy of the day is stale, so the plan views must refetch. */
function isStalePlanError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    error.code != null &&
    STALE_PLAN_CODES.has(error.code)
  )
}

type PlanActionsProps = {
  plan: DailyPlanResponse | null
  planDate: string
  today?: string
  replan?: { run: () => void; isPending: boolean; error: unknown }
}

/**
 * The plan header actions once a plan exists. Regenerate shows only while nothing is recorded,
 * and Re-plan is the one solid control. A missing plan's Generate lives in the empty rail.
 */
export function PlanActions({
  plan,
  planDate,
  today = getLocalDateString(),
  replan,
}: PlanActionsProps) {
  const { mutate, isPending } = useGeneratePlan()
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false)
  const [conflict, setConflict] = useState(false)
  const queryClient = useQueryClient()
  const visibility = actionVisibility(plan, planDate, today)

  async function handlePlanConflict(error: unknown) {
    if (!isStalePlanError(error)) {
      return
    }
    setConflict(true)
    await queryClient.invalidateQueries({ queryKey: plansByDateQueryPrefix })
  }

  const replanFailure = replanErrorMessage(replan?.error)

  const replanErrorAlert =
    replanFailure != null ? (
      <Alert variant="destructive">
        <AlertDescription>{replanFailure}</AlertDescription>
      </Alert>
    ) : null

  const conflictAlert = conflict ? (
    <Alert>
      <AlertDescription>{PLAN_CONFLICT_MESSAGE}</AlertDescription>
    </Alert>
  ) : null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {conflictAlert}
      {replanErrorAlert}
      {visibility.regenerate ? (
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          aria-busy={isPending}
          onClick={() => setConfirmingRegenerate(true)}
        >
          <RotateCcwIcon />
          {isPending ? 'Generating…' : 'Regenerate'}
        </Button>
      ) : null}

      {visibility.replan && replan != null ? (
        <Button
          type="button"
          disabled={replan.isPending}
          aria-busy={replan.isPending}
          onClick={() => replan.run()}
        >
          <RefreshCwIcon />
          {replan.isPending ? 'Re-planning…' : 'Re-plan'}
        </Button>
      ) : null}

      <AlertDialog
        open={confirmingRegenerate}
        onOpenChange={setConfirmingRegenerate}
      >
        <AlertDialogContent aria-label="Regenerate this day">
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate this day?</AlertDialogTitle>
            <AlertDialogDescription>
              Regenerating replaces the current plan for {planDate} with a fresh
              schedule. Nothing is recorded yet, so no outcomes are lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={() => {
                setConfirmingRegenerate(false)
                if (plan != null) {
                  mutate(
                    { planDate, replacePlanId: plan.id },
                    { onError: handlePlanConflict },
                  )
                }
              }}
            >
              Regenerate plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
