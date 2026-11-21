import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

import { Skeleton } from '@/components/ui/skeleton'
import { CommitmentsPanel } from '@/features/commitments/CommitmentsPanel'
import { useCommitments } from '@/features/commitments/hooks'
import { AgendaList } from '@/features/plans/AgendaList'
import { DayRail } from '@/features/plans/DayRail'
import { GenerateButton } from '@/features/plans/GenerateButton'
import { BlockKindLegend, OutcomeLegend } from '@/features/plans/railLegends'
import { InfoPopover } from '@/components/InfoPopover'
import { OutcomeDialog } from '@/features/plans/OutcomeDialog'
import { headerMetaParts, type HeaderMetaPart } from '@/features/plans/headerMeta'
import { planlessRailPlan } from '@/features/plans/planlessRail'
import { PlanActions } from '@/features/plans/PlanActions'
import { PlanHealth } from '@/features/plans/PlanHealth'
import { StatsStrip } from '@/features/plans/StatsStrip'
import { WorkSessions } from '@/features/plans/WorkSessions'
import { usePlanByDate } from '@/features/plans/hooks'
import { useRegeneratePrompt } from '@/features/plans/regeneratePrompt'
import {
  buildRail,
  toMinutes,
  type Density,
} from '@/features/plans/railModel'
import { todayStats } from '@/features/plans/todayStats'
import { useReplanPlan } from '@/features/plans/useReplanPlan'
import { useSchedulingPreferences } from '@/features/preferences/hooks'
import { useHorizon } from '@/features/horizon/hooks'
import { useTasks } from '@/features/tasks/hooks'
import { MiniTasksCard } from '@/features/tasks/MiniTasksCard'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatClock, formatDateLabel, formatDuration } from '@/lib/format'
import {
  getLocalDateString,
  getLocalTimeString,
  isPastPlanningDate,
  nextPlanningDate,
  resolvePlanningDate,
} from '@/lib/planningDate'
import { cn } from '@/lib/utils'
import type { TaskResponse, WorkBlockResponse } from '@/types/api'

const CLOCK_TICK_MS = 60_000

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'compact', label: 'Compact' },
]

function Panel({
  title,
  titleExtra,
  action,
  children,
  bodyClassName,
}: {
  title: string
  titleExtra?: ReactNode
  action?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-4 py-2">
        <h2 className="text-base leading-5 font-semibold">{title}</h2>
        {titleExtra}
        <span className="flex-1" />
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

function RailSkeleton() {
  return (
    <div role="status" aria-label="Loading plan" className="flex flex-col gap-2 p-4">
      {[64, 96, 48, 80].map((height) => (
        <Skeleton key={height} className="w-full rounded-md" style={{ height }} />
      ))}
    </div>
  )
}

/** The day before `iso`, computed in local time through the existing date helper. */
function previousDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  return getLocalDateString(new Date(year!, month! - 1, day! - 1))
}

/**
 * Today: the planning date in the query, the plan for that date, and the rail that explains it.
 */
export function TodayPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const planDate = resolvePlanningDate(searchParams.get('date'))
  const today = getLocalDateString()
  // A past day is a record: blocks open nothing and commitments cannot change.
  const readOnly = isPastPlanningDate(planDate, today)
  const { plan, hasPlan, isPending, isError, refetch } = usePlanByDate(planDate)
  const { preferences } = useSchedulingPreferences()
  const { commitments } = useCommitments(planDate)
  const { needed: regenerateNeeded, dismiss: dismissRegeneratePrompt } =
    useRegeneratePrompt()
  const replan = useReplanPlan(plan)
  const isMobile = useIsMobile()
  const [density, setDensity] = useState<Density>('comfortable')
  const [selectedBlockId, setSelectedBlockId] = useState<number | null>(null)
  const { tasks } = useTasks()
  const { horizon } = useHorizon()
  const horizonRowByTaskId = useMemo(
    () => new Map((horizon?.tasks ?? []).map((row) => [row.taskId, row])),
    [horizon],
  )
  const [nowMinutes, setNowMinutes] = useState(() =>
    toMinutes(getLocalTimeString()),
  )
  const stats = todayStats(plan, planDate, today, nowMinutes)
  const rail =
    plan != null
      ? buildRail(plan, planDate === today ? nowMinutes : null, density)
      : preferences != null
        ? buildRail(
            planlessRailPlan(preferences, commitments),
            planDate === today ? nowMinutes : null,
            density,
          )
        : null
  // The plan-less rail draws its Peak wash from preferences, so the chip reads the same source.
  const peakSource = plan ?? preferences
  const settled = !isPending && !isError
  const replayedAt = plan?.revisions.at(-1)?.cutoff ?? null
  const selectedBlock =
    selectedBlockId != null && plan != null
      ? (plan.composedRail.find(
          (item): item is WorkBlockResponse =>
            item.id === selectedBlockId && item.kind === 'WORK',
        ) ?? null)
      : null

  function findLiveTask(block: WorkBlockResponse): TaskResponse | null {
    const referenceId =
      block.taskSnapshot.taskReferenceId ?? block.taskSnapshot.sourceTaskId
    return tasks.find((task) => task.id === referenceId) ?? null
  }

  useEffect(() => {
    if (planDate !== today) {
      return
    }
    const id = setInterval(() => {
      setNowMinutes(toMinutes(getLocalTimeString()))
    }, CLOCK_TICK_MS)
    return () => clearInterval(id)
  }, [planDate, today])

  useEffect(() => {
    if (searchParams.get('date') !== planDate) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('date', planDate)
      setSearchParams(nextParams, { replace: true })
    }
  }, [planDate, searchParams, setSearchParams])

  function renderMetaPart(part: HeaderMetaPart): ReactNode {
    switch (part) {
      case 'schedule':
        return preferences == null ? null : (
          <>
            Work window{' '}
            <span className="font-mono text-xs text-foreground">
              {formatClock(preferences.workDayStart)}&ndash;
              {formatClock(preferences.workDayEnd)}
            </span>{' '}
            &middot; Trailing buffer{' '}
            <span className="font-mono text-xs text-foreground">
              {formatDuration(preferences.bufferMinutes)}
            </span>
          </>
        )
      case 'replanned':
        return replayedAt == null ? null : (
          <>
            Re-planned{' '}
            <span className="font-mono text-xs text-foreground">
              {formatClock(replayedAt)}
            </span>
          </>
        )
      case 'noPlan':
        return 'No Daily plan yet'
      case 'past':
        return 'Past day · read-only'
      case 'upcoming':
        return 'Upcoming day'
    }
  }

  function goToDate(next: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('date', next)
    setSearchParams(nextParams)
  }

  const noPlanCard = (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-input bg-card p-6 text-center">
      <CalendarDaysIcon className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="font-display text-lg leading-7 font-medium">No Daily plan yet</p>
      <p className="text-sm text-muted-foreground">
        Generate a plan to place today&rsquo;s work on the rail.
      </p>
      <GenerateButton planDate={planDate} />
    </div>
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">
            Daily plan
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={`Previous day: ${formatDateLabel(previousDate(planDate))}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => goToDate(previousDate(planDate))}
            >
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
            </button>
            <h1 className="font-display text-xl leading-9 font-medium tracking-[-0.01em] whitespace-nowrap">
              {formatDateLabel(planDate)}
            </h1>
            <button
              type="button"
              aria-label={`Next day: ${formatDateLabel(nextPlanningDate(planDate))}`}
              className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-hidden hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => goToDate(nextPlanningDate(planDate))}
            >
              <ChevronRightIcon className="size-4" aria-hidden="true" />
            </button>
            {planDate === today ? null : (
              <button
                type="button"
                className="ml-1 inline-flex h-8 items-center rounded-md px-2 text-sm font-medium text-primary outline-hidden hover:bg-secondary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={() => goToDate(today)}
              >
                Back to today
              </button>
            )}
          </div>
          <p className="text-sm leading-5 text-muted-foreground">
            {headerMetaParts({
              hasPreferences: preferences != null,
              hasPlan,
              replayedAt,
              planDate,
              today,
            }).map((part, index) => (
              <Fragment key={part}>
                {index > 0 ? ' · ' : null}
                {renderMetaPart(part)}
              </Fragment>
            ))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <fieldset
            aria-label="Rail density"
            className="inline-flex h-8 flex-none items-center gap-0.5 rounded-md border border-input bg-card p-0.5"
          >
            {DENSITIES.map((option) => {
              const active = density === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-full items-center rounded px-2.5 text-sm font-medium tracking-[0.02em] whitespace-nowrap outline-hidden transition-colors focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active
                      ? 'bg-accent text-foreground ring-1 ring-primary ring-inset'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  )}
                  onClick={() => setDensity(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </fieldset>
          {settled && hasPlan ? (
            <PlanActions
              plan={plan}
              planDate={planDate}
              today={today}
              replan={replan}
            />
          ) : null}
        </div>
      </header>

      <StatsStrip stats={stats} />

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 min-[1180px]:grid-cols-[minmax(0,1fr)_360px]">
        <Panel
          title="Day rail"
          titleExtra={
            <>
              <InfoPopover label="About block kinds" title="Block kinds">
                <BlockKindLegend />
              </InfoPopover>
              <InfoPopover label="About outcomes" title="Outcomes">
                <OutcomeLegend />
              </InfoPopover>
            </>
          }
          action={
            peakSource?.peakStart != null && peakSource.peakEnd != null ? (
              <>
                <span className="inline-flex items-center gap-1.5 text-xs tracking-[0.01em] whitespace-nowrap text-muted-foreground">
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-[3px] rounded-sm bg-peak-edge"
                  />
                  <span>Peak window</span>
                  <span className="font-mono text-foreground">
                    {formatClock(peakSource.peakStart)}&ndash;
                    {formatClock(peakSource.peakEnd)}
                  </span>
                </span>
                <InfoPopover label="About the Peak window" title="Peak window" align="end">
                  <p>
                    Your highest-focus hours. They are shown on the rail only and
                    do not change how tasks are scheduled.
                  </p>
                </InfoPopover>
              </>
            ) : null
          }
        >
          {isPending ? <RailSkeleton /> : null}
          {isError ? (
            <div role="alert" className="flex items-center gap-3 p-4 text-sm">
              <span>Today could not be loaded.</span>
              <button type="button" className="underline" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {settled && rail != null
            ? isMobile
              ? <AgendaList rail={rail} onSelect={readOnly ? undefined : setSelectedBlockId} />
              : (
                <DayRail
                  rail={rail}
                  onSelect={readOnly ? undefined : setSelectedBlockId}
                  empty={plan == null ? noPlanCard : undefined}
                />
              )
            : null}
          {settled && plan == null && (isMobile || rail == null) ? (
            <div className="p-4">{noPlanCard}</div>
          ) : null}
          {settled && readOnly && plan != null ? (
            <div className="p-4">
              <WorkSessions blocks={plan.composedRail} />
            </div>
          ) : null}
        </Panel>

        <div className="flex flex-col gap-4">
          {settled && regenerateNeeded && hasPlan ? (
            <div
              role="status"
              className="flex items-center justify-between gap-3 rounded-md border border-input bg-card px-3 py-2 text-sm"
            >
              <span>Regenerate to apply changes.</span>
              <button
                type="button"
                className="rounded px-2 py-1 text-xs font-medium text-muted-foreground outline-hidden hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
                onClick={dismissRegeneratePrompt}
              >
                Dismiss
              </button>
            </div>
          ) : null}
          {settled && plan != null ? (
            <Panel title="Plan health" bodyClassName="flex flex-col gap-3 p-3">
              <PlanHealth plan={plan} today={today} replan={replan} />
            </Panel>
          ) : null}
          <CommitmentsPanel planDate={planDate} readOnly={readOnly} />
          <MiniTasksCard tasks={tasks} horizonRowByTaskId={horizonRowByTaskId} />
        </div>
      </div>

      {plan != null && selectedBlock != null ? (
        <OutcomeDialog
          plan={plan}
          block={selectedBlock}
          task={findLiveTask(selectedBlock)}
          now={planDate === today ? getLocalTimeString() : null}
          onClose={() => setSelectedBlockId(null)}
        />
      ) : null}
    </div>
  )
}
