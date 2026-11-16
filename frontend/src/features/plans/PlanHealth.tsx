import type { ReactNode } from 'react'
import { InboxIcon, LinkIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react'

import { InfoPopover } from '@/components/InfoPopover'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { actionVisibility } from '@/features/plans/planActionRules'
import { planHealth } from '@/features/plans/planHealthModel'
import { formatWaitingOn, indexSnapshotTitles } from '@/features/plans/planSnapshotCopy'
import type { ReplanControl } from '@/features/plans/useReplanPlan'
import { formatDuration } from '@/lib/format'
import { getLocalDateString } from '@/lib/planningDate'
import type { DailyPlanResponse } from '@/types/api'

type PlanHealthProps = {
  plan: DailyPlanResponse | null
  today?: string
  replan?: ReplanControl
}

function HealthRow({
  icon,
  label,
  count,
  detail,
}: {
  icon: ReactNode
  label: string
  count: number
  detail: string
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 not-first:border-t not-first:border-border">
      <span className="inline-flex flex-none text-muted-foreground">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-[18px] font-medium">{label}</span>
        <span className="truncate text-xs leading-4 tracking-[0.01em] text-muted-foreground">
          {detail}
        </span>
      </span>
      <span className="flex-none text-right font-mono text-sm">{count}</span>
    </li>
  )
}

/** Plan health explains the plan; with no plan there is nothing to explain. */
export function PlanHealth({
  plan,
  today = getLocalDateString(),
  replan,
}: PlanHealthProps) {
  if (plan == null) {
    return null
  }

  const health = planHealth(plan)
  const snapshotTitles = indexSnapshotTitles(plan)
  const canReplan =
    replan != null && actionVisibility(plan, plan.planDate, today).replan

  return (
    <div data-slot="plan-health" className="flex flex-col gap-3">
      {health.shortfall != null ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>
            Shortfall &middot;{' '}
            <span className="font-mono">{formatDuration(health.shortfall.minutes)}</span>
          </AlertTitle>
          <AlertDescription>
            <ul className="flex flex-col gap-1">
              {health.shortfall.rows.map((row) => (
                <li key={row.title}>
                  {row.title} &middot; {row.placed} of {row.total}m placed
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <ul>
        <HealthRow
          icon={<LinkIcon />}
          label="Blocked work"
          count={health.blocked.length}
          detail={
            health.blocked.length > 0
              ? health.blocked
                  .map(
                    (entry) =>
                      `${entry.title} · Waiting on ${formatWaitingOn(
                        entry.waitingOn,
                        snapshotTitles,
                      )}`,
                  )
                  .join(', ')
              : 'None'
          }
        />
        <HealthRow
          icon={<InboxIcon />}
          label="Unplaced work"
          count={health.unplaced.length}
          detail={
            health.unplaced.length > 0
              ? `${health.unplaced.map((entry) => entry.title).join(', ')} · No estimate`
              : 'None'
          }
        />
      </ul>

      {plan.needsRefresh ? (
        <Alert>
          <RefreshCwIcon />
          <AlertTitle className="flex items-center gap-1">
            Needs refresh
            <InfoPopover label="About Needs refresh" title="Needs refresh">
              <p>
                Tasks, commitments or settings changed after this plan was made.
                Re-plan to fit the rest of today.
              </p>
            </InfoPopover>
          </AlertTitle>
          <AlertDescription>
            <p>
              Tasks, commitments or settings changed after this plan was made.
            </p>
            {canReplan ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={replan.isPending}
                  aria-busy={replan.isPending}
                  onClick={() => replan.run()}
                >
                  <RefreshCwIcon />
                  {replan.isPending ? 'Re-planning…' : 'Re-plan'}
                </Button>
              </div>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
