import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DayTimeline } from '@/features/plans/DayTimeline'
import { PlanWarningAlert } from '@/features/plans/PlanWarningAlert'
import type { DailyPlanResponse, UnplacedWorkResponse } from '@/types/api'

type DailyPlanViewProps = {
  plan: DailyPlanResponse | null
  title?: string
  emptyDescription?: string
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
}

function DailyPlanViewSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          <Skeleton className="h-4 w-32" />
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          role="status"
          aria-label="Loading plan"
          className="flex flex-col gap-3"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton
              key={index}
              data-testid="plan-skeleton-row"
              className="h-12 w-full rounded-lg"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function buildUnplacedCopy(entry: UnplacedWorkResponse): string {
  if (entry.reason === 'NO_ESTIMATE') {
    return `${entry.taskSnapshot.title}: no estimate — add one to put it on the clock`
  }

  return `${entry.taskSnapshot.title}: out of time — ${entry.unplacedMinutes ?? 0} min unplaced`
}

export function DailyPlanView({
  plan,
  title = "Today's plan",
  emptyDescription = 'No plan for today yet.',
  isPending = false,
  isError = false,
  onRetry,
}: DailyPlanViewProps) {
  if (isPending) {
    return <DailyPlanViewSkeleton title={title} />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load plan</AlertTitle>
        <AlertDescription>
          Something went wrong while loading today&apos;s plan.
        </AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (plan == null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{emptyDescription}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const showReducedBufferNote =
    plan.realizedBufferMinutes < plan.requestedBufferMinutes

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {plan.scheduledWorkMinutes} min scheduled across {plan.blocks.length}{' '}
          block{plan.blocks.length === 1 ? '' : 's'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {plan.warning != null ? <PlanWarningAlert warning={plan.warning} /> : null}

        {showReducedBufferNote ? (
          <p className="text-sm text-muted-foreground">
            Fixed breaks or commitments reduced contingency; only{' '}
            {plan.realizedBufferMinutes} of {plan.requestedBufferMinutes} requested
            buffer minutes were reserved.
          </p>
        ) : null}

        <DayTimeline plan={plan} />

        {plan.unplacedWork.length > 0 ? (
          <section aria-label="Unplaced work">
            <h3 className="mb-2 text-sm font-medium">Unplaced work</h3>
            <ul className="flex flex-col gap-2">
              {plan.unplacedWork.map((entry) => (
                <li
                  key={`${entry.reason}-${entry.taskSnapshot.sourceTaskId}`}
                  className="rounded-md border border-dashed border-border px-3 py-2 text-sm"
                >
                  {buildUnplacedCopy(entry)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  )
}
