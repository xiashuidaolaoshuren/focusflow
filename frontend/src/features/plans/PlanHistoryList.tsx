import {
  CalendarDaysIcon,
  ClockIcon,
  RefreshCwIcon,
  TriangleAlertIcon,
} from 'lucide-react'
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
import { formatDateLabel, formatDuration } from '@/lib/format'
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
          Generate a daily plan from Today to see it here.
        </p>
      </div>
      <Button render={<Link to="/today" />}>Go to Today</Button>
    </div>
  )
}

export function PlanHistoryList({
  plans,
  page,
  size,
  totalElements,
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
      <table className="w-full text-sm">
        <caption className="sr-only">Saved Daily plans</caption>
        <thead>
          <tr className="border-b border-border text-left text-xs tracking-wider text-muted-foreground uppercase">
            <th scope="col" className="px-3 py-2 font-medium">Date</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Focus</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Sessions</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {plans.map((plan) => (
            <tr key={plan.id} className="border-t border-border first:border-t-0">
              <td className="px-3 py-2">
                <Link to={`/plans/${plan.id}`} className="font-medium hover:underline">
                  {formatDateLabel(plan.planDate)}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {formatDuration(plan.scheduledWorkMinutes)}
              </td>
              <td className="px-3 py-2 text-right font-mono">{plan.workSessionCount}</td>
              <td className="px-3 py-2">
                <span className="flex flex-wrap items-center gap-2">
                  {plan.hasShortfall ? (
                    <Badge variant="outline" className="h-5 gap-1 rounded-sm bg-card text-deadline-at-risk">
                      <TriangleAlertIcon aria-hidden />
                      Shortfall
                    </Badge>
                  ) : null}
                  {plan.hasProgress ? (
                    <Badge variant="outline" className="h-5 gap-1 rounded-sm bg-card text-status-in-progress">
                      <ClockIcon aria-hidden />
                      Progress
                    </Badge>
                  ) : null}
                  {plan.needsRefresh ? (
                    <Badge variant="outline" className="h-5 gap-1 rounded-sm bg-card text-primary">
                      <RefreshCwIcon aria-hidden />
                      Needs refresh
                    </Badge>
                  ) : null}
                  {!plan.hasShortfall && !plan.hasProgress && !plan.needsRefresh ? (
                    <span className="text-muted-foreground">—</span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <PlanDeleteButton
                  plan={plan}
                  variant="icon"
                  isDeleting={isDeleting}
                  onConfirm={() => handleDelete(plan)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
          <span className="font-mono">
            {page * size + 1}–{page * size + plans.length}
          </span>{' '}
          of <span className="font-mono">{totalElements}</span>
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
