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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { creditFor, isCrossingNow, plannedMinutes, wouldExhaustRemainder } from '@/features/plans/progressRules'
import { useRecordBlockProgress } from '@/features/plans/hooks'
import { getLocalDateString, getLocalTimeString } from '@/lib/planningDate'
import type {
  DailyPlanResponse,
  TaskResponse,
  WorkBlockResponse,
  WorkOutcome,
} from '@/types/api'

const OUTCOME_ITEMS: { value: WorkOutcome; label: string }[] = [
  { value: 'DONE', label: 'Done' },
  { value: 'PARTLY_DONE', label: 'Partly done' },
  { value: 'SKIPPED', label: 'Skipped' },
]

type BlockProgressDialogProps = {
  plan: DailyPlanResponse
  block: WorkBlockResponse
  task: TaskResponse | null
  onClose: () => void
  onConflict: () => void
}

function formatClockTime(time: string): string {
  return time.slice(0, 5)
}

function formatPlanned(block: WorkBlockResponse): string {
  return `${plannedMinutes(block)} min planned`
}

function formatActual(block: WorkBlockResponse): string {
  return block.actualMinutes != null
    ? `${block.actualMinutes} min actual`
    : 'Not recorded'
}

function formatRemainingEffort(
  block: WorkBlockResponse,
  task: TaskResponse | null,
): string {
  if (task != null) {
    return task.remainingEffortMinutes != null
      ? `${task.remainingEffortMinutes} min remaining`
      : 'Unknown remaining'
  }

  const captured = block.taskSnapshot?.capturedRemainingEffortMinutes ?? null
  return captured != null
    ? `${captured} min captured remaining`
    : 'Unknown remaining'
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export function BlockProgressDialog({
  plan,
  block,
  task,
  onClose,
  onConflict,
}: BlockProgressDialogProps) {
  const { mutate, isPending } = useRecordBlockProgress({ onConflict })
  const [outcome, setOutcome] = useState<WorkOutcome | null>(block.outcome)
  const [actualMinutes, setActualMinutes] = useState(
    block.actualMinutes != null ? String(block.actualMinutes) : '',
  )
  const [finish, setFinish] = useState(false)
  const [reassess, setReassess] = useState(false)
  const [checkpointMinutes, setCheckpointMinutes] = useState('')
  const [reconcile, setReconcile] = useState(false)
  const [unknownRemainder, setUnknownRemainder] = useState(false)
  const isCrossing = isCrossingNow(block, getLocalTimeString())
  const hidesActualMinutes = outcome === 'SKIPPED' && !reconcile

  function parsedActualMinutes(): number | null {
    if (actualMinutes.trim() === '') {
      return null
    }
    const parsed = Number.parseInt(actualMinutes, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  function hasPositiveCheckpoint(): boolean {
    const parsed = Number.parseInt(checkpointMinutes, 10)
    return Number.isFinite(parsed) && parsed > 0
  }

  function hasRemainderInput(): boolean {
    return unknownRemainder || hasPositiveCheckpoint()
  }

  /**
   * A fresh save whose provisional credit would leave nothing over needs an explicit finish or
   * reassessment. A correction (the block already carries an outcome) is left to the server.
   */
  function isExhaustionBlocked(): boolean {
    if (block.outcome != null || finish) {
      return false
    }
    if (reassess && hasRemainderInput()) {
      return false
    }
    if (outcome == null) {
      return false
    }
    const credit = creditFor(outcome, plannedMinutes(block), parsedActualMinutes())
    return wouldExhaustRemainder(task?.remainingEffortMinutes ?? null, credit)
  }

  function canSave(): boolean {
    if (outcome == null) {
      return false
    }
    if (reconcile) {
      const actual = parsedActualMinutes()
      return actual != null && actual >= 0 && hasRemainderInput()
    }
    if (outcome === 'PARTLY_DONE') {
      const actual = parsedActualMinutes()
      if (actual == null || actual <= 0) {
        return false
      }
    }
    return !isExhaustionBlocked()
  }

  function buildCheckpoint(): { remainingEffortMinutes: number | null } | null {
    if (reconcile || reassess) {
      if (unknownRemainder) {
        return { remainingEffortMinutes: null }
      }
      const parsed = Number.parseInt(checkpointMinutes, 10)
      if (Number.isFinite(parsed) && parsed > 0) {
        return { remainingEffortMinutes: parsed }
      }
      if (reconcile) {
        return { remainingEffortMinutes: null }
      }
    }
    return null
  }

  function handleSave() {
    if (outcome == null || !canSave()) {
      return
    }

    mutate(
      {
        planId: plan.id,
        blockId: block.id,
        request: {
          outcome,
          actualMinutes: hidesActualMinutes ? null : parsedActualMinutes(),
          currentDate: getLocalDateString(),
          expectedProgressVersion: block.progressVersion,
          finish: reconcile ? false : finish,
          checkpoint: buildCheckpoint(),
          cutoff: reconcile ? getLocalTimeString() : null,
        },
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <AlertDialogContent aria-label="Record outcome">
        <AlertDialogHeader>
          <AlertDialogTitle>Record outcome</AlertDialogTitle>
          <AlertDialogDescription>
            Log what happened during this session
            {block.taskSnapshot != null ? ` for ${block.taskSnapshot.title}` : ''} (
            {formatClockTime(block.startTime)}–{formatClockTime(block.endTime)}).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="flex flex-col gap-2 px-4">
          <SummaryRow label="Planned" value={formatPlanned(block)} />
          <SummaryRow label="Actual" value={formatActual(block)} />
          <SummaryRow
            label="Remaining effort"
            value={formatRemainingEffort(block, task)}
          />
        </dl>
        <div className="flex flex-col gap-3 px-4">
          <div className="flex flex-col gap-2">
            <Label>Outcome</Label>
            <Select
              value={outcome}
              onValueChange={(value) => setOutcome(value as WorkOutcome)}
            >
              <SelectTrigger aria-label="Outcome" className="w-full">
                <SelectValue placeholder="Choose an outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {OUTCOME_ITEMS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          {hidesActualMinutes ? null : (
            <div className="flex flex-col gap-2">
              <Label htmlFor={`actual-minutes-${block.id}`}>Actual minutes</Label>
              <Input
                id={`actual-minutes-${block.id}`}
                type="number"
                min={1}
                value={actualMinutes}
                onChange={(event) => setActualMinutes(event.target.value)}
              />
            </div>
          )}
          {isCrossing ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label="Reconcile the elapsed portion"
                checked={reconcile}
                onChange={(event) => setReconcile(event.target.checked)}
              />
              Reconcile the elapsed portion
            </label>
          ) : null}
          {reconcile ? (
            <>
              <p className="text-sm text-muted-foreground">
                Enter the time spent so far and the effort still needed. A reconciled session
                keeps no planned-duration credit.
              </p>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`reconcile-minutes-${block.id}`}>
                  Remaining effort minutes
                </Label>
                <Input
                  id={`reconcile-minutes-${block.id}`}
                  type="number"
                  min={1}
                  value={checkpointMinutes}
                  disabled={unknownRemainder}
                  onChange={(event) => setCheckpointMinutes(event.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Remaining effort is unknown"
                  checked={unknownRemainder}
                  onChange={(event) => setUnknownRemainder(event.target.checked)}
                />
                Remaining effort is unknown
              </label>
            </>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Finish task"
                  checked={finish}
                  onChange={(event) => setFinish(event.target.checked)}
                />
                Finish task
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Reassess remaining effort"
                  checked={reassess}
                  onChange={(event) => setReassess(event.target.checked)}
                />
                Reassess remaining effort
              </label>
              {reassess ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`checkpoint-minutes-${block.id}`}>
                    Remaining effort minutes
                  </Label>
                  <Input
                    id={`checkpoint-minutes-${block.id}`}
                    type="number"
                    min={1}
                    value={checkpointMinutes}
                    onChange={(event) => setCheckpointMinutes(event.target.value)}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={!canSave() || isPending} onClick={handleSave}>
            Save outcome
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
