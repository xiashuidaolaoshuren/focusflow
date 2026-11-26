import { useState } from 'react'

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
import { Button } from '@/components/ui/button'
import { useDeleteUnplannedWork } from '@/features/plans/hooks'
import {
  formatWaitingOn,
  indexSnapshotTitles,
  type SnapshotTitleInfo,
} from '@/features/plans/planSnapshotCopy'
import { UnplannedWorkDialog } from '@/features/plans/UnplannedWorkDialog'
import { useTasks } from '@/features/tasks/hooks'
import type { DailyPlanResponse, UnplacedWorkResponse } from '@/types/api'

const UNPLACED_REASON_TEXT: Record<UnplacedWorkResponse['reason'], string> = {
  NO_ESTIMATE: 'No estimate',
  BLOCKED: 'Waiting on another task',
  OUT_OF_TIME: 'Out of time',
}

/** Blocked work names its blockers from the plan's own snapshots, so the names survive later edits. */
function unplacedReasonText(entry: UnplacedWorkResponse, snapshotTitles: Map<number, SnapshotTitleInfo>): string {
  if (entry.reason === 'BLOCKED' && entry.blockerSourceTaskIds.length > 0) {
    return `Waiting on ${formatWaitingOn(entry.blockerSourceTaskIds, snapshotTitles)}`
  }
  return UNPLACED_REASON_TEXT[entry.reason]
}

type PlanSideCardsProps = {
  plan: DailyPlanResponse
  /** The selected revision's unplaced rows; defaults to the plan's latest list. */
  unplacedWork?: UnplacedWorkResponse[]
  /** Titles for the selected view; defaults to the plan-wide index. */
  snapshotTitles?: Map<number, SnapshotTitleInfo>
}

/** Unplanned work (recorded outside the plan) and unplaced work (did not fit), for a saved plan. */
export function PlanSideCards({
  plan,
  unplacedWork = plan.unplacedWork,
  snapshotTitles = indexSnapshotTitles(plan),
}: PlanSideCardsProps) {
  const { tasks } = useTasks()
  const { mutate: deleteUnplannedWork, isPending: isDeleting } =
    useDeleteUnplannedWork()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
  const [logging, setLogging] = useState(false)

  function handleDelete(entryId: number) {
    const entry = plan.unplannedWork.find((item) => item.id === entryId)
    const liveTask =
      entry?.taskReferenceId != null
        ? (tasks.find((task) => task.id === entry.taskReferenceId) ?? null)
        : null
    deleteUnplannedWork({
      id: entryId,
      effortVersion: liveTask?.effortVersion ?? null,
    })
    setPendingDeleteId(null)
  }

  return (
    <>
      <section
        aria-labelledby="unplanned-work-title"
        className="rounded-lg border border-border bg-card"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <h2 id="unplanned-work-title" className="text-base font-semibold">
            Unplanned work
          </h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLogging(true)}
          >
            Log unplanned work
          </Button>
        </div>
        {plan.unplannedWork.length > 0 ? (
          <ul className="border-t border-border">
            {plan.unplannedWork.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm first:border-t-0"
              >
                <span>
                  <span className="font-mono">{entry.workDate}</span> · {entry.actualMinutes} min
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete unplanned work for ${entry.workDate}`}
                  disabled={isDeleting}
                  onClick={() => setPendingDeleteId(entry.id)}
                >
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">None</p>
        )}
      </section>

      <section
        aria-labelledby="unplaced-work-title"
        className="rounded-lg border border-border bg-card"
      >
        <h2 id="unplaced-work-title" className="px-4 py-3 text-base font-semibold">
          Unplaced work
        </h2>
        {unplacedWork.length > 0 ? (
          <ul className="border-t border-border">
            {unplacedWork.map((entry) => (
              <li
                key={`${entry.reason}-${entry.taskSnapshot.sourceTaskId}`}
                className="flex items-center justify-between gap-3 border-t border-border px-4 py-2.5 text-sm first:border-t-0"
              >
                <span className="truncate">{entry.taskSnapshot.title}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  <span>{unplacedReasonText(entry, snapshotTitles)}</span>
                  {entry.unplacedMinutes != null ? ` · ${entry.unplacedMinutes}m` : ''}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">None</p>
        )}
      </section>

      {logging ? (
        <UnplannedWorkDialog
          planDate={plan.planDate}
          tasks={tasks}
          onClose={() => setLogging(false)}
        />
      ) : null}

      <AlertDialog
        open={pendingDeleteId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteId(null)
          }
        }}
      >
        <AlertDialogContent aria-label="Delete unplanned entry">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unplanned entry</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the recorded unplanned minutes. The task remainder keeps only the
              credit that remains after reversing them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (pendingDeleteId != null) {
                  handleDelete(pendingDeleteId)
                }
              }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
