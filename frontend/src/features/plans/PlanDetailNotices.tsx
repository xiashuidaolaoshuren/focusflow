import { Alert, AlertDescription } from '@/components/ui/alert'
import { PlanWarningAlert } from '@/features/plans/PlanWarningAlert'
import { indexSnapshotTitles } from '@/features/plans/planSnapshotCopy'
import type { DailyPlanResponse } from '@/types/api'

/** Plan-level notices shown above a saved plan's rail. */
export function PlanDetailNotices({ plan }: { plan: DailyPlanResponse }) {
  const snapshotTitles = indexSnapshotTitles(plan)
  const showReducedBufferNote = plan.realizedBufferMinutes < plan.requestedBufferMinutes

  return (
    <div className="flex flex-col gap-3">
      {plan.needsRefresh ? (
        <Alert>
          <AlertDescription>
            This plan needs refresh: remaining effort or the plannable tasks changed after it was
            scheduled. It keeps its current schedule until you refresh it yourself.
          </AlertDescription>
        </Alert>
      ) : null}

      {plan.warning != null ? (
        <PlanWarningAlert warning={plan.warning} snapshotTitles={snapshotTitles} />
      ) : null}

      {showReducedBufferNote ? (
        <p className="text-sm text-muted-foreground">
          Fixed breaks or commitments reduced contingency; only {plan.realizedBufferMinutes} of{' '}
          {plan.requestedBufferMinutes} requested buffer minutes were reserved.
        </p>
      ) : null}
    </div>
  )
}
