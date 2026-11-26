import { useQueryClient } from '@tanstack/react-query'
import { ClockIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import { AgendaList } from '@/features/plans/AgendaList'
import { DayRail } from '@/features/plans/DayRail'
import { PlanDeleteButton } from '@/features/plans/PlanDeleteButton'
import { PlanDetailNotices } from '@/features/plans/PlanDetailNotices'
import { PlanRevisionSwitch } from '@/features/plans/PlanRevisionSwitch'
import { PlanSideCards } from '@/features/plans/PlanSideCards'
import { WorkSessions } from '@/features/plans/WorkSessions'
import { buildRail } from '@/features/plans/railModel'
import { toClockMinutes } from '@/lib/planningDate'
import { formatClock, formatDateLabel, formatDuration } from '@/lib/format'
import {
  indexRevisionSnapshotTitles,
  type SnapshotTitleInfo,
} from '@/features/plans/planSnapshotCopy'
import {
  revisionBlocks,
  revisionUnplacedWork,
} from '@/features/plans/revisionView'
import { useIsMobile } from '@/hooks/use-mobile'
import { useDeletePlan, usePlan } from '@/features/plans/hooks'
import { plansListQueryPrefix } from '@/lib/query'
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
      ? `/today?date=${cachedPlanDate}`
      : '/plans'
  const recoveryLabel =
    cachedPlanDate != null
      ? `Back to plan for ${formatDateLabel(cachedPlanDate)}`
      : 'Back to plan history'

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
          Plan not found
        </h1>
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
  const [selectedRevisionId, setSelectedRevisionId] = useState<number | null>(
    null,
  )
  const isMobile = useIsMobile()

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

  const selectedBlocks =
    plan == null ? [] : revisionBlocks(plan, selectedRevisionId)
  const selectedUnplacedWork =
    plan == null ? [] : revisionUnplacedWork(plan, selectedRevisionId)
  const selectedSnapshotTitles =
    plan == null
      ? new Map<number, SnapshotTitleInfo>()
      : indexRevisionSnapshotTitles(plan, selectedRevisionId)
  const rail =
    plan == null
      ? null
      : buildRail(
          { ...plan, composedRail: selectedBlocks },
          null,
          'comfortable',
        )
  const workBlocks = selectedBlocks.filter((block) => block.kind === 'WORK')
  const focusMinutes = workBlocks.reduce(
    (sum, block) => sum + toClockMinutes(block.endTime) - toClockMinutes(block.startTime),
    0,
  )
  const selectedRevision = plan?.revisions.find(
    (revision) => revision.id === selectedRevisionId,
  )
  const savedAt =
    selectedRevision?.cutoff != null
      ? formatClock(selectedRevision.cutoff)
      : plan != null
        ? new Date(plan.createdAt).toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : ''

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Daily plan
          </span>
          <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em]">
            {plan != null ? formatDateLabel(plan.planDate) : 'Plan detail'}
          </h1>
          {plan != null ? (
            <p className="text-sm text-muted-foreground">
              Focus <span className="font-mono">{formatDuration(focusMinutes)}</span>
              {' · '}Sessions <span className="font-mono">{workBlocks.length}</span>
              {' · '}Saved <span className="font-mono">{savedAt}</span>
            </p>
          ) : null}
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
      {plan != null ? (
        <PlanRevisionSwitch
          revisions={plan.revisions}
          selectedRevisionId={selectedRevisionId}
          onSelect={setSelectedRevisionId}
        />
      ) : null}
      {plan != null ? <PlanDetailNotices plan={plan} /> : null}
      {plan != null && rail != null ? (
        <div className="grid items-start gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_360px]">
          <section
            aria-label="Day rail"
            className="rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Day rail</h2>
              <span className="flex-1" />
              <Badge variant="outline" className="h-5 gap-1 rounded-sm bg-card text-muted-foreground">
                <ClockIcon className="size-3" aria-hidden />
                Read-only
              </Badge>
            </div>
            {isMobile ? <AgendaList rail={rail} /> : <DayRail rail={rail} />}
          </section>
          <div className="flex flex-col gap-4">
            <WorkSessions blocks={selectedBlocks} />
            {plan != null ? (
              <PlanSideCards
                plan={plan}
                unplacedWork={selectedUnplacedWork}
                snapshotTitles={selectedSnapshotTitles}
              />
            ) : null}
          </div>
        </div>
      ) : null}
      <Link to="/plans" className={backLinkClassName}>
        Back to plan history
      </Link>
    </div>
  )
}
