import { useState } from 'react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
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
import { BlockProgressDialog } from '@/features/plans/BlockProgressDialog'
import { DayTimeline } from '@/features/plans/DayTimeline'
import { PlanWarningAlert } from '@/features/plans/PlanWarningAlert'
import { PLAN_CONFLICT_MESSAGE } from '@/features/plans/planConflicts'
import { UnplannedWorkForm } from '@/features/plans/UnplannedWorkForm'
import { useDeleteUnplannedWork } from '@/features/plans/hooks'
import { useTasks } from '@/features/tasks/hooks'
import {
  formatNeededFor,
  formatWaitingOn,
  indexSnapshotTitles,
  type SnapshotTitleInfo,
} from '@/features/plans/planSnapshotCopy'
import type {
  DailyPlanResponse,
  ScheduledBlockResponse,
  TaskResponse,
  UnplacedWorkResponse,
  WorkBlockResponse,
} from '@/types/api'

type DailyPlanViewProps = {
  plan: DailyPlanResponse | null
  title?: string
  emptyDescription?: string
  isPending?: boolean
  isError?: boolean
  onRetry?: () => void
  selectedRevisionId?: number | null
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

function buildUnplacedCopy(
  entry: UnplacedWorkResponse,
  titleIndex: Map<number, SnapshotTitleInfo>,
): string {
  const title = entry.taskSnapshot.title
  const neededSuffix = (() => {
    const neededFor = formatNeededFor(entry.taskSnapshot, titleIndex)
    return neededFor != null ? ` · ${neededFor}` : ''
  })()

  if (entry.reason === 'NO_ESTIMATE') {
    return `${title}: no estimate — add one to put it on the clock${neededSuffix}`
  }

  if (entry.reason === 'BLOCKED') {
    const waitingOn = formatWaitingOn(entry.blockerSourceTaskIds, titleIndex)
    return `${title}: Waiting on ${waitingOn} — ${entry.unplacedMinutes ?? 0} min unplaced${neededSuffix}`
  }

  return `${title}: out of time — ${entry.unplacedMinutes ?? 0} min unplaced${neededSuffix}`
}

function neededForNotesFromRail(
  rail: ScheduledBlockResponse[],
  titleIndex: Map<number, SnapshotTitleInfo>,
): string[] {
  const seen = new Set<number>()
  const notes: string[] = []

  for (const block of rail) {
    if (block.kind !== 'WORK') {
      continue
    }
    const sourceTaskId = block.taskSnapshot.sourceTaskId
    if (seen.has(sourceTaskId)) {
      continue
    }
    const neededFor = formatNeededFor(block.taskSnapshot, titleIndex)
    if (neededFor == null) {
      continue
    }
    seen.add(sourceTaskId)
    notes.push(`${block.taskSnapshot.title}: ${neededFor}`)
  }

  return notes
}

function formatClockTime(time: string): string {
  return time.slice(0, 5)
}

function formatSessionCount(count: number): string {
  return `${count} session${count === 1 ? '' : 's'} missing actual minutes`
}

function hasRecordedWork(plan: DailyPlanResponse): boolean {
  return (
    plan.knownActualMinutes > 0 ||
    plan.missingActualCount > 0 ||
    plan.offRailEarlyCompletions.length > 0 ||
    plan.unplannedWork.length > 0
  )
}

function RecordedWorkSection({
  plan,
  tasks,
}: {
  plan: DailyPlanResponse
  tasks: TaskResponse[]
}) {
  const { mutate: deleteUnplannedWork, isPending: isDeleting } =
    useDeleteUnplannedWork()
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  function handleDelete(entryId: number) {
    const entry = plan.unplannedWork.find((item) => item.id === entryId)
    const liveTask =
      entry?.taskReferenceId != null
        ? tasks.find((task) => task.id === entry.taskReferenceId) ?? null
        : null
    deleteUnplannedWork({
      id: entryId,
      effortVersion: liveTask?.effortVersion ?? null,
    })
    setPendingDeleteId(null)
  }

  return (
    <section aria-label="Recorded work" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Recorded work</h3>
      <p className="text-sm text-muted-foreground">
        {plan.knownActualMinutes} min recorded
        {plan.missingActualCount > 0
          ? ` · ${formatSessionCount(plan.missingActualCount)}`
          : ''}
      </p>

      {plan.offRailEarlyCompletions.length > 0 ? (
        <ul aria-label="Off-rail early completions" className="flex flex-col gap-2">
          {plan.offRailEarlyCompletions.map((block) => (
            <li
              key={`off-rail-${block.id}`}
              className="rounded-md border border-border px-3 py-2 text-sm"
            >
              {block.kind === 'WORK' && block.taskSnapshot != null
                ? `${block.taskSnapshot.title}: completed ${formatClockTime(block.startTime)}–${formatClockTime(block.endTime)} · ${
                    block.actualMinutes != null
                      ? `${block.actualMinutes} min actual`
                      : 'actual not recorded'
                  }`
                : `${block.label ?? 'Session'} ${formatClockTime(block.startTime)}–${formatClockTime(block.endTime)}`}
            </li>
          ))}
        </ul>
      ) : null}

      {plan.unplannedWork.length > 0 ? (
        <ul aria-label="Unplanned work" className="flex flex-col gap-2">
          {plan.unplannedWork.map((entry) => (
            <li
              key={`unplanned-${entry.id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm"
            >
              <span>
                {entry.workDate} · {entry.actualMinutes} min
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
    </section>
  )
}

export function DailyPlanView({
  plan,
  title = "Today's plan",
  emptyDescription = 'No plan for today yet.',
  isPending = false,
  isError = false,
  onRetry,
  selectedRevisionId = null,
}: DailyPlanViewProps) {
  const [selectedBlock, setSelectedBlock] = useState<WorkBlockResponse | null>(
    null,
  )
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [showUnplannedForm, setShowUnplannedForm] = useState(false)
  const { tasks } = useTasks()

  function findLiveTask(block: WorkBlockResponse): TaskResponse | null {
    const referenceId =
      block.taskSnapshot.taskReferenceId ?? block.taskSnapshot.sourceTaskId
    return tasks.find((task) => task.id === referenceId) ?? null
  }

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

  const rail =
    selectedRevisionId == null
      ? plan.composedRail
      : (plan.revisions.find((revision) => revision.id === selectedRevisionId)
          ?.blocks ?? plan.composedRail)
  const snapshotTitles = indexSnapshotTitles(plan)
  const neededForNotes = neededForNotesFromRail(rail, snapshotTitles)

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
      {conflictMessage != null ? (
        <Alert>
          <AlertDescription>{conflictMessage}</AlertDescription>
        </Alert>
      ) : null}

      {plan.needsRefresh ? (
        <Alert>
          <AlertDescription>
            This plan needs refresh: remaining effort or the plannable tasks changed after it was
            scheduled. It keeps its current schedule until you refresh it yourself.
          </AlertDescription>
        </Alert>
      ) : null}

      {plan.warning != null ? (
        <PlanWarningAlert
          warning={plan.warning}
          snapshotTitles={snapshotTitles}
        />
      ) : null}

        {showReducedBufferNote ? (
          <p className="text-sm text-muted-foreground">
            Fixed breaks or commitments reduced contingency; only{' '}
            {plan.realizedBufferMinutes} of {plan.requestedBufferMinutes} requested
            buffer minutes were reserved.
          </p>
        ) : null}

        <DayTimeline
          plan={{ ...plan, blocks: rail }}
          onBlockClick={setSelectedBlock}
        />

        {neededForNotes.length > 0 ? (
          <ul aria-label="Inherited urgency" className="flex flex-col gap-1 text-sm">
            {neededForNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}

        {hasRecordedWork(plan) ? (
          <RecordedWorkSection plan={plan} tasks={tasks} />
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowUnplannedForm((visible) => !visible)}
          >
            Add unplanned work
          </Button>
          {showUnplannedForm ? (
            <UnplannedWorkForm
              planDate={plan.planDate}
              tasks={tasks}
              onSubmitted={() => setShowUnplannedForm(false)}
            />
          ) : null}
        </div>

        {plan.unplacedWork.length > 0 ? (
          <section aria-label="Unplaced work">
            <h3 className="mb-2 text-sm font-medium">Unplaced work</h3>
            <ul className="flex flex-col gap-2">
              {plan.unplacedWork.map((entry) => (
                <li
                  key={`${entry.reason}-${entry.taskSnapshot.sourceTaskId}`}
                  className="rounded-md border border-dashed border-border px-3 py-2 text-sm"
                >
                  {buildUnplacedCopy(entry, snapshotTitles)}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
      {selectedBlock != null ? (
        <BlockProgressDialog
          plan={plan}
          block={selectedBlock}
          task={findLiveTask(selectedBlock)}
          onClose={() => setSelectedBlock(null)}
          onConflict={() => {
            setConflictMessage(PLAN_CONFLICT_MESSAGE)
            setSelectedBlock(null)
          }}
        />
      ) : null}
    </Card>
  )
}
