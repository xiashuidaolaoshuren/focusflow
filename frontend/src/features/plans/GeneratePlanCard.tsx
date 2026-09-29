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
import { useGeneratePlan } from '@/features/plans/hooks'
import { ApiError } from '@/lib/api'
import type { DailyPlanResponse } from '@/types/api'

type GeneratePlanCardProps = {
  planDate: string
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

export function GeneratePlanCard({ planDate }: GeneratePlanCardProps) {
  const { mutate, isPending, isError, error, reset } = useGeneratePlan()
  const [conflict, setConflict] = useState<ConflictState | null>(null)

  const showGenerateError =
    isError && error instanceof Error && !isPlanConflictError(error)

  function handleSuccess() {
    toast.success(`Plan generated for ${planDate}`)
    setConflict(null)
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

          const existingPlan = await getPlanByDate(planDate)
          setConflict({ existingPlan })
        },
      },
    )
  }

  function handleGenerateClick() {
    setConflict(null)
    reset()
    submitGenerate()
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
