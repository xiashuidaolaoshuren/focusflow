import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DailyPlanView } from '@/features/plans/DailyPlanView'
import { PlanDeleteButton } from '@/features/plans/PlanDeleteButton'
import { plansListQueryPrefix, useDeletePlan, usePlan } from '@/features/plans/hooks'
import { ApiError } from '@/lib/api'
import type { DailyPlanSummaryResponse, PageResponse } from '@/types/api'

const backLinkClassName =
  'inline-flex h-8 w-fit items-center justify-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function parsePlanId(idParam: string | undefined): number {
  if (idParam == null) {
    return Number.NaN
  }

  const parsed = Number.parseInt(idParam, 10)
  return Number.isNaN(parsed) ? Number.NaN : parsed
}

function PlanDetailSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading plan"
      className="flex flex-col gap-4"
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  )
}

function useCachedPlanDate(planId: number): string | null {
  const queryClient = useQueryClient()
  const cachedQueries = queryClient.getQueriesData<
    PageResponse<DailyPlanSummaryResponse>
  >({ queryKey: plansListQueryPrefix })

  for (const [, data] of cachedQueries) {
    const match = data?.content.find((plan) => plan.id === planId)
    if (match != null) {
      return match.planDate
    }
  }

  return null
}

type PlanNotFoundStateProps = {
  planId: number
}

function PlanNotFoundState({ planId }: PlanNotFoundStateProps) {
  const cachedPlanDate = useCachedPlanDate(planId)
  const recoveryHref =
    cachedPlanDate != null
      ? `/dashboard?date=${cachedPlanDate}`
      : '/plans'
  const recoveryLabel =
    cachedPlanDate != null
      ? `Back to plan for ${cachedPlanDate}`
      : 'Back to plan history'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan not found</h1>
        <p className="text-sm text-muted-foreground">
          This saved plan does not exist or is no longer available.
        </p>
      </div>
      <Link to={recoveryHref} className={backLinkClassName}>
        {recoveryLabel}
      </Link>
    </div>
  )
}

export function PlanDetailPage() {
  const navigate = useNavigate()
  const { id: idParam } = useParams<{ id: string }>()
  const planId = parsePlanId(idParam)
  const { plan, isPending, isError, error, refetch } = usePlan(planId)
  const { mutate: deletePlan, isPending: isDeleting } = useDeletePlan()

  function handleDelete() {
    if (plan == null) {
      return
    }

    deletePlan(plan.id, {
      onSuccess: () => {
        toast.success('Plan deleted')
        navigate('/plans')
      },
    })
  }

  if (!Number.isInteger(planId) || planId <= 0) {
    return <PlanNotFoundState planId={planId} />
  }

  if (isPending) {
    return <PlanDetailSkeleton />
  }

  if (isError) {
    if (error instanceof ApiError && error.status === 404) {
      return <PlanNotFoundState planId={planId} />
    }

    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load plan</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plan detail</h1>
          <p className="text-sm text-muted-foreground">
            Saved plan for {plan?.planDate ?? 'unknown date'}.
          </p>
        </div>
        {plan != null && (
          <PlanDeleteButton
            plan={plan}
            variant="text"
            isDeleting={isDeleting}
            onConfirm={handleDelete}
          />
        )}
      </div>
      <DailyPlanView plan={plan} title={`Plan for ${plan?.planDate ?? ''}`} />
      <Link to="/plans" className={backLinkClassName}>
        Back to plan history
      </Link>
    </div>
  )
}
