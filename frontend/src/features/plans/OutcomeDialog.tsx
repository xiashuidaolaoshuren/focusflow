import { useState } from 'react'
import { XIcon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { outcomeSchema } from '@/components/form/schemas'
import {
  creditFor,
  isCrossingNow,
  plannedMinutes,
  wouldExhaustRemainder,
} from '@/features/plans/progressRules'
import { useRecordBlockProgress } from '@/features/plans/hooks'
import { formatClock, formatDuration } from '@/lib/format'
import { getLocalDateString, getLocalTimeString } from '@/lib/planningDate'
import { cn } from '@/lib/utils'
import type {
  DailyPlanResponse,
  TaskResponse,
  WorkBlockResponse,
  WorkOutcome,
} from '@/types/api'

const OUTCOMES: { value: WorkOutcome; label: string }[] = [
  { value: 'DONE', label: 'Done' },
  { value: 'PARTLY_DONE', label: 'Partly done' },
  { value: 'SKIPPED', label: 'Skipped' },
]

function minutesBetween(start: string, end: string): number {
  const [startHour, startMinute] = start.slice(0, 5).split(':').map(Number)
  const [endHour, endMinute] = end.slice(0, 5).split(':').map(Number)
  return endHour! * 60 + endMinute! - (startHour! * 60 + startMinute!)
}

function SummaryStat({
  value,
  caption,
  divider = false,
}: {
  value: string
  caption: string
  divider?: boolean
}) {
  return (
    <div
      className={cn(
        'grid gap-0.5 px-4 py-3',
        divider && 'border-l border-border',
      )}
    >
      <span className="text-lg leading-7 font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs leading-4 text-muted-foreground">{caption}</span>
    </div>
  )
}

export type OutcomeDialogProps = {
  plan: DailyPlanResponse
  block: WorkBlockResponse
  task: TaskResponse | null
  /** The clock on the plan's own day; `null` for a past or future day, which never reconciles. */
  now?: string | null
  onClose: () => void
}

export function OutcomeDialog({
  plan,
  block,
  task,
  now = getLocalTimeString(),
  onClose,
}: OutcomeDialogProps) {
  const { mutate, isPending } = useRecordBlockProgress({
    onConflict: () => setConflict(true),
  })
  const [outcome, setOutcome] = useState<WorkOutcome | null>(block.outcome)
  const [actualMinutes, setActualMinutes] = useState(
    block.actualMinutes != null ? String(block.actualMinutes) : '',
  )
  const [minutesTouched, setMinutesTouched] = useState(false)
  const [finish, setFinish] = useState(false)
  const [reassess, setReassess] = useState(false)
  const [unknownRemainder, setUnknownRemainder] = useState(false)
  const [checkpointMinutes, setCheckpointMinutes] = useState('')
  const [conflict, setConflict] = useState(false)
  const crossing = now != null && block.outcome == null && isCrossingNow(block, now)
  const hidesActualMinutes = outcome === 'SKIPPED' && !crossing
  const hasRemainderInput =
    unknownRemainder ||
    (Number.isFinite(Number.parseInt(checkpointMinutes, 10)) &&
      Number.parseInt(checkpointMinutes, 10) > 0)

  /**
   * A fresh save whose provisional credit would leave nothing over needs an explicit finish or
   * reassessment. A correction (the block already carries an outcome) is left to the server.
   */
  function isExhaustionBlocked(): boolean {
    if (block.outcome != null || finish) {
      return false
    }
    if (reassess && hasRemainderInput) {
      return false
    }
    if (outcome == null) {
      return false
    }
    const credit = creditFor(outcome, plannedMinutes(block), parsedActualMinutes())
    return wouldExhaustRemainder(
      task?.remainingEffortMinutes ?? null,
      credit,
    )
  }

  const validation = outcomeSchema.safeParse({
    outcome: outcome ?? undefined,
    actualMinutes,
    reconcile: crossing,
  })
  const errorMessage = validation.success
    ? undefined
    : validation.error.issues[0]?.message
  const displayedError = minutesTouched ? errorMessage : undefined
  const canSave =
    outcome != null &&
    validation.success &&
    (!crossing || hasRemainderInput) &&
    !isExhaustionBlocked()

  const plannedStat = crossing
    ? minutesBetween(block.startTime, now)
    : plannedMinutes(block)
  const recordedMinutes =
    outcome == null ? null : hidesActualMinutes ? 0 : parsedActualMinutes()
  const capturedRemaining =
    task?.remainingEffortMinutes ??
    block.taskSnapshot?.capturedRemainingEffortMinutes ??
    null
  const checkpointValue = Number.parseInt(checkpointMinutes, 10)
  const projectedRemaining =
    outcome == null
      ? null
      : finish
        ? 0
        : reassess && hasRemainderInput
          ? checkpointValue
          : crossing
            ? unknownRemainder
              ? null
              : Number.isFinite(checkpointValue)
                ? checkpointValue
                : capturedRemaining
            : capturedRemaining != null && recordedMinutes != null
              ? Math.max(
                  0,
                  capturedRemaining - (recordedMinutes - (block.actualMinutes ?? 0)),
                )
              : capturedRemaining

  const title = block.taskSnapshot?.title ?? 'Task'

  function parsedActualMinutes(): number | null {
    if (actualMinutes.trim() === '') {
      return null
    }
    const parsed = Number.parseInt(actualMinutes, 10)
    return Number.isFinite(parsed) ? parsed : null
  }

  function handleSave() {
    if (!canSave || outcome == null) {
      return
    }

    const remainder = unknownRemainder
      ? null
      : Number.parseInt(checkpointMinutes, 10)
    const checkpoint = crossing
      ? { remainingEffortMinutes: Number.isFinite(remainder) ? remainder : null }
      : reassess && Number.isFinite(remainder) && (remainder ?? 0) > 0
        ? { remainingEffortMinutes: remainder }
        : null

    mutate(
      {
        planId: plan.id,
        blockId: block.id,
        request: {
          outcome,
          actualMinutes: hidesActualMinutes ? null : parsedActualMinutes(),
          currentDate: getLocalDateString(),
          expectedProgressVersion: block.progressVersion,
          finish: crossing ? false : finish,
          checkpoint,
          cutoff: crossing ? now : null,
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
      <AlertDialogContent
        aria-label="Record outcome"
        className="w-[min(440px,calc(100vw-32px))] max-w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-48px)] gap-0 overflow-y-auto rounded-lg p-0"
      >
        <div className="grid gap-4 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <AlertDialogTitle className="font-display text-lg leading-7">
                {crossing ? 'Reconcile elapsed portion' : 'Record outcome'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {title} &middot;{' '}
                <span className="font-mono">
                  {formatClock(block.startTime)}&ndash;
                  {formatClock(crossing ? now : block.endTime)}
                </span>
                {crossing ? (
                  <>
                    {' '}
                    of{' '}
                    <span className="font-mono">
                      {formatClock(block.startTime)}&ndash;
                      {formatClock(block.endTime)}
                    </span>
                  </>
                ) : null}
              </AlertDialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="-mt-1 -mr-1 size-8 flex-none"
              onClick={onClose}
            >
              <XIcon className="size-4" aria-hidden="true" />
            </Button>
          </div>

          {conflict ? (
            <Alert variant="warning">
              <AlertTitle>Plan changed elsewhere</AlertTitle>
              <AlertDescription>
                Another device saved this Daily plan. The latest Daily plan has
                been loaded. Check the outcome and save again.
              </AlertDescription>
            </Alert>
          ) : null}

          <fieldset className="grid gap-2">
            <legend className="text-sm leading-[18px] font-medium">
              Outcome
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOMES.map((item) => (
                <label
                  key={item.value}
                  className="relative flex h-10 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium has-checked:border-primary has-checked:bg-accent has-checked:ring-1 has-checked:ring-primary has-checked:ring-inset"
                >
                  <input
                    type="radio"
                    name="outcome"
                    value={item.value}
                    className="absolute inset-0 m-0 cursor-pointer opacity-0"
                    checked={outcome === item.value}
                    onChange={() => setOutcome(item.value)}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {hidesActualMinutes ? null : (
            <Field label="Actual minutes" error={displayedError}>
              {(control) => (
                <div className="flex items-center gap-1.5">
                  <Input
                    {...control}
                    type="number"
                    min={0}
                    value={actualMinutes}
                    disabled={outcome == null}
                    onChange={(event) => {
                      setMinutesTouched(true)
                      setActualMinutes(event.target.value)
                    }}
                  />
                  <span className="text-sm text-muted-foreground">min</span>
                </div>
              )}
            </Field>
          )}

          <div className="grid grid-cols-3 overflow-hidden rounded-md border border-border">
            <SummaryStat
              value={formatDuration(plannedStat)}
              caption={crossing ? 'Elapsed' : 'Planned'}
            />
            <SummaryStat
              divider
              value={
                recordedMinutes == null ? '—' : formatDuration(recordedMinutes)
              }
              caption="Recorded"
            />
            <SummaryStat
              divider
              value={
                projectedRemaining == null
                  ? '—'
                  : formatDuration(projectedRemaining)
              }
              caption="Remaining effort"
            />
          </div>

          {crossing ? (
            <>
              <Field label="Remaining effort minutes">
                {(control) => (
                  <div className="flex items-center gap-1.5">
                    <Input
                      {...control}
                      type="number"
                      min={0}
                      value={checkpointMinutes}
                      disabled={unknownRemainder}
                      onChange={(event) =>
                        setCheckpointMinutes(event.target.value)
                      }
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                )}
              </Field>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Remaining effort is unknown"
                  checked={unknownRemainder}
                  onChange={(event) => setUnknownRemainder(event.target.checked)}
                />
                <span>Remaining effort is unknown</span>
              </label>
            </>
          ) : null}

          {crossing ? null : (
            <>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Finish task"
                  checked={finish}
                  onChange={(event) => setFinish(event.target.checked)}
                />
                <span>Finish task</span>
              </label>
              <div className="grid justify-items-start gap-2">
                <Button
                  type="button"
                  variant="link"
                  aria-expanded={reassess}
                  className="h-auto p-0 text-sm"
                  onClick={() => setReassess((open) => !open)}
                >
                  Reassess remaining effort
                </Button>
                {reassess ? (
                  <div className="grid w-full gap-2 rounded-md border border-dashed border-input p-3">
                    <Field label="Remaining effort minutes">
                      {(control) => (
                        <div className="flex items-center gap-1.5">
                          <Input
                            {...control}
                            type="number"
                            min={0}
                            value={checkpointMinutes}
                            onChange={(event) =>
                              setCheckpointMinutes(event.target.value)
                            }
                          />
                          <span className="text-sm text-muted-foreground">
                            min
                          </span>
                        </div>
                      )}
                    </Field>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>

        <AlertDialogFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 pt-3 pb-4">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button disabled={!canSave || isPending} onClick={handleSave}>
            Save outcome
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
