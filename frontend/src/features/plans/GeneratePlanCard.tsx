import { useState } from 'react'
import { toast } from 'sonner'

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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { getPlanByDate } from '@/features/plans/api'
import { useGeneratePlan, useReplan } from '@/features/plans/hooks'
import {
  latestRevisionId,
  planHasProgress,
  replanErrorMessage,
} from '@/features/plans/planConflicts'
import { useTasks } from '@/features/tasks/hooks'
import { getLocalDateString, getLocalTimeString } from '@/lib/planningDate'
import { ApiError } from '@/lib/api'
import type { DailyPlanResponse } from '@/types/api'

type GeneratePlanCardProps = {
  planDate: string
  plan?: DailyPlanResponse | null
}

type ConflictState = {
  existingPlan: DailyPlanResponse | null
}

function isPlanConflictError(error: Error): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === 'PLAN_EXISTS' || error.code === 'PLAN_CHANGED')
  )
}

export function GeneratePlanCard({ planDate, plan = null }: GeneratePlanCardProps) {
  const { mutate, isPending, isError, error, reset } = useGeneratePlan()
  const [isReplanDialogOpen, setIsReplanDialogOpen] = useState(false)
  const { tasks } = useTasks()
  const {
    mutate: replan,
    isPending: isReplanning,
    isError: isReplanError,
    error: replanError,
  } = useReplan()
  const [conflict, setConflict] = useState<ConflictState | null>(null)
  const [conflictRefetchFailure, setConflictRefetchFailure] = useState<Error | null>(null)

  const showGenerateError =
    isError && error instanceof Error && !isPlanConflictError(error)

  function handleSuccess() {
    toast.success(`Plan generated for ${planDate}`)
    setConflict(null)
    setConflictRefetchFailure(null)
    reset()
  }

  function submitGenerate(replacePlanId?: number) {
    mutate(
      replacePlanId != null
        ? { planDate, replacePlanId }
        : { planDate },
      {
        onSuccess: handleSuccess,
        onError: async (mutationError) => {
          if (!isPlanConflictError(mutationError)) {
            return
          }

          try {
            const existingPlan = await getPlanByDate(planDate)
            setConflict({ existingPlan })
          } catch {
            setConflictRefetchFailure(mutationError)
          }
        },
      },
    )
  }

  function handleGenerateClick() {
    setConflict(null)
    setConflictRefetchFailure(null)
    reset()
    submitGenerate()
  }

  if (plan != null && planHasProgress(plan)) {
    const isToday = planDate === getLocalDateString()

    function handleConfirmReplan() {
      const revisionId = latestRevisionId(plan!)
      if (revisionId == null) {
        return
      }
      replan(
        {
          id: plan!.id,
          request: {
            currentDate: getLocalDateString(),
            cutoff: getLocalTimeString(),
            expectedRevisionId: revisionId,
            effortVersions: tasks
              .filter(
                (task) =>
                  task.status === 'OPEN' || task.status === 'IN_PROGRESS',
              )
              .map((task) => ({
                taskId: task.id,
                effortVersion: task.effortVersion,
              })),
          },
        },
        { onSuccess: () => setIsReplanDialogOpen(false) },
      )
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Re-plan this day</CardTitle>
          <CardDescription>
            {planDate} already has recorded work, so it is scheduled by re-planning rather
            than regenerating.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {isReplanError && replanErrorMessage(replanError) != null ? (
              <Alert variant="destructive">
                <AlertTitle>Could not re-plan this day</AlertTitle>
                <AlertDescription>
                  {replanErrorMessage(replanError)}
                </AlertDescription>
              </Alert>
            ) : null}
            {isToday ? (
              <Button
                type="button"
                onClick={() => setIsReplanDialogOpen(true)}
              >
                Re-plan remaining day
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Only today&apos;s plan can be re-planned. This day keeps its recorded work and
                cannot be regenerated.
              </p>
            )}
          </div>
        </CardContent>
        <AlertDialog
          open={isReplanDialogOpen}
          onOpenChange={setIsReplanDialogOpen}
        >
          <AlertDialogContent aria-label="Confirm re-plan">
            <AlertDialogHeader>
              <AlertDialogTitle>Re-plan the remaining day?</AlertDialogTitle>
              <AlertDialogDescription>
                Re-planning from {getLocalTimeString().slice(0, 5)} keeps the work already
                recorded and schedules only what remains. Your commitments will be reloaded,
                and the focus stretch restarts without recording a break.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isReplanning}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={isReplanning}
                onClick={handleConfirmReplan}
              >
                Confirm re-plan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    )
  }

  function handleConfirmConflict() {
    if (conflict?.existingPlan) {
      submitGenerate(conflict.existingPlan.id)
      return
    }

    submitGenerate()
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Generate plan</CardTitle>
          <CardDescription>
            Create a scheduled plan for {planDate}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {showGenerateError && (
              <Alert variant="destructive">
                <AlertTitle>Could not generate plan</AlertTitle>
                <AlertDescription>{error.message}</AlertDescription>
              </Alert>
            )}
            {conflictRefetchFailure && (
              <Alert variant="destructive">
                <AlertTitle>Could not generate plan</AlertTitle>
                <AlertDescription>
                  Could not check the current plan for {planDate}:{' '}
                  {conflictRefetchFailure.message}
                </AlertDescription>
              </Alert>
            )}
            <Button type="button" disabled={isPending} onClick={handleGenerateClick}>
              {isPending ? 'Generating…' : `Generate plan for ${planDate}`}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={conflict != null}
        onOpenChange={(open) => {
          if (!open) {
            setConflict(null)
          }
        }}
      >
        <AlertDialogContent aria-label="Replace existing plan">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflict?.existingPlan
                ? 'Replace existing plan?'
                : 'Create a fresh plan?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflict?.existingPlan
                ? `A plan already exists for ${planDate}. Regenerating will replace it.`
                : `No plan remains for ${planDate}. You can create a fresh plan.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmConflict}>
              {conflict?.existingPlan ? 'Replace plan' : 'Create plan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
