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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useReassessRemainingEffort } from '@/features/tasks/hooks'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import { getLocalDateString } from '@/lib/planningDate'
import type { TaskResponse } from '@/types/api'

export const SAME_DAY_ORDERING_COPY =
  'Work logged later for that same date counts as new progress.'

type RemainingEffortControlProps = {
  task: TaskResponse
  onEffortConflict?: () => void
}

export function RemainingEffortControl({
  task,
  onEffortConflict,
}: RemainingEffortControlProps) {
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const { mutate, isPending } = useReassessRemainingEffort({
    onEffortConflict: () => {
      setConflictMessage(PROGRESS_CONFLICT_MESSAGE)
      setIsOpen(false)
      onEffortConflict?.()
    },
  })
  const [isOpen, setIsOpen] = useState(false)
  const [minutes, setMinutes] = useState('')
  const [isUnknown, setIsUnknown] = useState(false)

  function resetForm() {
    setMinutes(
      task.remainingEffortMinutes != null
        ? String(task.remainingEffortMinutes)
        : '',
    )
    setIsUnknown(false)
  }

  function handleOpenChange(open: boolean) {
    setIsOpen(open)
    if (open) {
      resetForm()
    }
  }

  function canSubmit(): boolean {
    if (isUnknown) {
      return true
    }
    const parsed = Number.parseInt(minutes, 10)
    return Number.isFinite(parsed) && parsed > 0
  }

  function handleSubmit() {
    if (!canSubmit()) {
      return
    }

    mutate(
      {
        id: task.id,
        request: {
          remainingEffortMinutes: isUnknown
            ? null
            : Number.parseInt(minutes, 10),
          currentDate: getLocalDateString(),
          effortVersion: task.effortVersion,
        },
      },
      {
        onSuccess: () => setIsOpen(false),
      },
    )
  }

  return (
    <>
      {conflictMessage ? (
        <Alert className="max-w-xs">
          <AlertDescription>{conflictMessage}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={`Reassess remaining effort for ${task.title}`}
        disabled={isPending}
        onClick={() => setIsOpen(true)}
      >
        Reassess remaining effort
      </Button>

      <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
        <AlertDialogContent aria-label="Reassess remaining effort">
          <AlertDialogHeader>
            <AlertDialogTitle>Reassess remaining effort</AlertDialogTitle>
            <AlertDialogDescription>
              Set how much work &quot;{task.title}&quot; still needs.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 px-4">
            <p className="text-sm text-muted-foreground">{SAME_DAY_ORDERING_COPY}</p>
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reassess-minutes-${task.id}`}>
                Remaining effort minutes
              </Label>
              <Input
                id={`reassess-minutes-${task.id}`}
                type="number"
                min={1}
                value={minutes}
                disabled={isUnknown}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label="Remaining effort is unknown"
                checked={isUnknown}
                onChange={(event) => setIsUnknown(event.target.checked)}
              />
              Remaining effort is unknown
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending || !canSubmit()}
              onClick={handleSubmit}
            >
              Save reassessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
