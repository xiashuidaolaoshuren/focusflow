import { useQueries } from '@tanstack/react-query'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getPlanById } from '@/features/plans/api'
import { planDetailQueryKey } from '@/lib/query'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import { useHorizon } from '@/features/horizon/hooks'
import { HorizonDayList } from '@/features/horizon/HorizonDayList'
import { HorizonGridView } from '@/features/horizon/HorizonGridView'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  HORIZON_PACE_COPY,
  longestFullWorkWindow,
  timeSpanMinutes,
} from '@/features/horizon/horizonGrid'

function HorizonPageSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading horizon">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function HorizonPage() {
  const { horizon, isPending, isError, error, refetch } = useHorizon()
  const { preferences } = useSchedulingPreferences()
  const isMobile = useIsMobile()

  const savedPlanIds =
    horizon?.days
      .filter((day) => day.kind === 'SAVED' && day.planId != null)
      .map((day) => day.planId as number) ?? []

  const uniquePlanIds = [...new Set(savedPlanIds)]

  const savedPlanQueries = useQueries({
    queries: uniquePlanIds.map((planId) => ({
      queryKey: planDetailQueryKey(planId),
      queryFn: () => getPlanById(planId),
      enabled: planId > 0,
    })),
  })

  if (isPending || !preferences) {
    return <HorizonPageSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load horizon</AlertTitle>
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

  if (horizon == null) {
    return null
  }

  const forecastWindowMinutes = timeSpanMinutes(
    preferences.workDayStart,
    preferences.workDayEnd,
  )

  const savedPlanWindows = savedPlanQueries
    .map((query) => query.data)
    .filter((plan): plan is NonNullable<typeof plan> => plan != null)
    .map((plan) => ({
      planId: plan.id,
      windowMinutes: timeSpanMinutes(plan.windowStart, plan.windowEnd),
    }))

  const scaleMinutes = longestFullWorkWindow(
    forecastWindowMinutes,
    savedPlanWindows,
    horizon.days,
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Horizon</h1>
        <p className="text-sm text-muted-foreground">
          Seven working days from {horizon.currentDate} at {horizon.currentTime}.
        </p>
        <p className="text-sm text-muted-foreground">{HORIZON_PACE_COPY}</p>
      </div>

      {horizon.tasks.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-lg font-medium">Nothing on the Horizon</p>
          <a className="text-sm underline" href="/tasks">
            Go to Tasks
          </a>
        </section>
      ) : isMobile ? (
        <HorizonDayList horizon={horizon} scaleMinutes={scaleMinutes} />
      ) : (
        <HorizonGridView horizon={horizon} scaleMinutes={scaleMinutes} />
      )}
    </div>
  )
}
