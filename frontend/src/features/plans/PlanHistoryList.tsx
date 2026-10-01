import { CalendarDaysIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PlanDeleteButton } from '@/features/plans/PlanDeleteButton'
import { useDeletePlan } from '@/features/plans/hooks'
import type { DailyPlanSummaryResponse } from '@/types/api'

type PlanHistoryListProps = {
  plans: DailyPlanSummaryResponse[]
  page: number
  size: number
  totalPages: number
  totalElements: number
  hasPrevious: boolean
  hasNext: boolean
  onPageChange: (page: number) => void
  isLoading: boolean
  isError: boolean
  onRetry?: () => void
}

function PlanHistoryListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading plans"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          data-testid="plan-skeleton-row"
          className="h-16 w-full rounded-xl"
        />
      ))}
    </div>
  )
}

function PlanHistoryListEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <CalendarDaysIcon className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">No saved plans yet</p>
        <p className="text-sm text-muted-foreground">
          Generate a daily plan from the dashboard to see it here.
        </p>
      </div>
      <Button render={<Link to="/dashboard" />}>Go to Dashboard</Button>
    </div>
  )
}

function formatSummaryCounts(plan: DailyPlanSummaryResponse): string {
  return `${plan.scheduledWorkMinutes} min · ${plan.workSessionCount} session${plan.workSessionCount === 1 ? '' : 's'} · ${plan.scheduledTaskCount} task${plan.scheduledTaskCount === 1 ? '' : 's'} · ${plan.unplacedWorkCount} unplaced`
}

export function PlanHistoryList({
  plans,
  page,
  totalPages,
  hasPrevious,
  hasNext,
  onPageChange,
  isLoading,
  isError,
  onRetry,
}: PlanHistoryListProps) {
  const { mutate: deletePlan, isPending: isDeleting } = useDeletePlan()

  function handleDelete(plan: DailyPlanSummaryResponse) {
    deletePlan(plan.id, {
      onSuccess: () => {
        toast.success('Plan deleted')
      },
    })
  }

  if (isLoading) {
    return <PlanHistoryListSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load plans</AlertTitle>
        <AlertDescription>Something went wrong while loading your plans.</AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (plans.length === 0) {
    return <PlanHistoryListEmpty />
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {plans.map((plan) => (
          <li
            key={plan.id}
            className="flex items-center gap-1 rounded-xl border border-border px-2 py-1"
          >
            <Link
              to={`/plans/${plan.id}`}
              className="flex flex-1 flex-col gap-1 rounded-lg px-2 py-2 transition-colors outline-none hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="font-medium">{plan.planDate}</span>
              <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {plan.hasWarning ? (
                  <Badge variant="secondary">Shortfall</Badge>
                ) : null}
                {formatSummaryCounts(plan)}
              </span>
            </Link>
            <PlanDeleteButton
              plan={plan}
              variant="icon"
              isDeleting={isDeleting}
              onConfirm={() => handleDelete(plan)}
            />
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasPrevious}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <p className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!hasNext}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
