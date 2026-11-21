import { useState } from 'react'
import { XIcon } from 'lucide-react'

import { DateField } from '@/components/form/DateField'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateUnplannedWork } from '@/features/plans/hooks'
import {
  buildUnplannedWorkRequest,
  canSubmitUnplannedWork,
} from '@/features/plans/unplannedWorkModel'
import { ApiError } from '@/lib/api'
import { getLocalDateString } from '@/lib/planningDate'
import type { TaskResponse } from '@/types/api'

export type UnplannedWorkDialogProps = {
  /** The plan's date; the work date defaults to it. */
  planDate: string
  tasks: TaskResponse[]
  onClose: () => void
}

/** Records minutes worked on a task outside the plan, for a current or past date. */
export function UnplannedWorkDialog({
  planDate,
  tasks,
  onClose,
}: UnplannedWorkDialogProps) {
  const { mutate, isPending } = useCreateUnplannedWork()
  const today = getLocalDateString()
  const [taskId, setTaskId] = useState<string | null>(null)
  const [workDate, setWorkDate] = useState(planDate)
  const [actualMinutes, setActualMinutes] = useState('')
  const [finish, setFinish] = useState(false)
  const [reassess, setReassess] = useState(false)
  const [checkpointMinutes, setCheckpointMinutes] = useState('')
  const [conflict, setConflict] = useState(false)

  const selectedTask = tasks.find((task) => String(task.id) === taskId) ?? null
  const draft = {
    taskId: selectedTask?.id ?? null,
    taskRemainingMinutes: selectedTask?.remainingEffortMinutes ?? null,
    effortVersion: selectedTask?.effortVersion ?? 0,
    workDate,
    actualMinutes,
    finish,
    reassess,
    checkpointMinutes,
    today,
  }
  const canSave = canSubmitUnplannedWork(draft) && !isPending

  function handleSave() {
    if (!canSave) {
      return
    }
    setConflict(false)
    mutate(buildUnplannedWorkRequest(draft), {
      onSuccess: () => onClose(),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) {
          setConflict(true)
        }
      },
    })
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
        aria-label="Log unplanned work"
        className="w-[min(440px,calc(100vw-32px))] max-w-[min(440px,calc(100vw-32px))] max-h-[calc(100dvh-48px)] gap-0 overflow-y-auto rounded-lg p-0"
      >
        <div className="grid gap-4 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="grid min-w-0 gap-0.5">
              <AlertDialogTitle className="text-md leading-6 font-semibold">
                Log unplanned work
              </AlertDialogTitle>
              <AlertDialogDescription>
                Minutes worked outside the plan. They never appear as a placed block.
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
              <AlertTitle>Progress changed elsewhere</AlertTitle>
              <AlertDescription>
                This task was updated on another device, so nothing was saved. Check the
                task and log the time again.
              </AlertDescription>
            </Alert>
          ) : null}

          <Field label="Task">
            {(control) => (
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger {...control} aria-label="Task" className="w-full">
                  <SelectValue placeholder="Choose a task" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {tasks.map((task) => (
                      <SelectItem key={task.id} value={String(task.id)}>
                        {task.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </Field>

          <Field label="Work date">
            {(control) => (
              <DateField
                id={control.id}
                value={workDate}
                max={today}
                onChange={setWorkDate}
              />
            )}
          </Field>

          <Field label="Actual minutes">
            {(control) => (
              <div className="flex items-center gap-1.5">
                <Input
                  {...control}
                  type="number"
                  min={1}
                  value={actualMinutes}
                  className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  onChange={(event) => setActualMinutes(event.target.value)}
                />
                <span className="text-sm text-muted-foreground">min</span>
              </div>
            )}
          </Field>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Finish task"
              checked={finish}
              onChange={(event) => setFinish(event.target.checked)}
            />
            <span>Finish task</span>
          </label>

          <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Reassess remaining effort"
              checked={reassess}
              onChange={(event) => setReassess(event.target.checked)}
            />
            <span>Reassess remaining effort</span>
          </label>

          {reassess ? (
            <Field label="Remaining effort minutes">
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  value={checkpointMinutes}
                  onChange={(event) => setCheckpointMinutes(event.target.value)}
                />
              )}
            </Field>
          ) : null}
        </div>

        <AlertDialogFooter className="flex-row items-center justify-end gap-2 border-t border-border px-5 pt-3 pb-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={!canSave} onClick={handleSave}>
            Log unplanned work
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
