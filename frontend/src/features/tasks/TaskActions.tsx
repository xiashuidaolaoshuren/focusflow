import { useState } from 'react'
import { MoreHorizontalIcon } from 'lucide-react'

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useUpdateTask } from '@/features/tasks/hooks'
import { STATUS_LABELS } from '@/features/tasks/labels'
import { canReturnToOpen } from '@/features/tasks/taskEffort'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import { buildTaskUpdateRequest } from '@/features/tasks/taskUpdate'
import { getLocalDateString } from '@/lib/planningDate'
import type { TaskResponse, TaskStatus } from '@/types/api'

const TASK_STATUSES: TaskStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
]

type TaskActionsProps = {
  task: TaskResponse
  onEdit: (task: TaskResponse) => void
  onDelete: (task: TaskResponse) => void
  onEffortConflict?: () => void
  isDeleting?: boolean
}

function isReopen(from: TaskStatus, to: TaskStatus): boolean {
  if (to !== 'OPEN' && to !== 'IN_PROGRESS') {
    return false
  }
  return from === 'DONE' || from === 'CANCELLED'
}

export function TaskActions({
  task,
  onEdit,
  onDelete,
  onEffortConflict,
  isDeleting = false,
}: TaskActionsProps) {
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const { mutate, isPending: isUpdating } = useUpdateTask({
    onEffortConflict: () => {
      setConflictMessage(PROGRESS_CONFLICT_MESSAGE)
      setIsFinishDialogOpen(false)
      setIsReopenDialogOpen(false)
      setReopenStatus(null)
      onEffortConflict?.()
    },
  })
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isFinishDialogOpen, setIsFinishDialogOpen] = useState(false)
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false)
  const [reopenStatus, setReopenStatus] = useState<TaskStatus | null>(null)
  const [reopenMinutes, setReopenMinutes] = useState('')
  const [reopenUnknown, setReopenUnknown] = useState(false)
  const isDisabled = isUpdating || isDeleting

  function handleStatusChange(nextStatus: TaskStatus) {
    if (nextStatus === task.status) {
      return
    }

    if (nextStatus === 'DONE') {
      setIsFinishDialogOpen(true)
      return
    }

    if (nextStatus === 'CANCELLED') {
      mutate({
        id: task.id,
        request: buildTaskUpdateRequest(task, { status: 'CANCELLED' }),
      })
      return
    }

    if (isReopen(task.status, nextStatus)) {
      setReopenStatus(nextStatus)
      setReopenMinutes('')
      setReopenUnknown(false)
      setIsReopenDialogOpen(true)
      return
    }

    mutate({
      id: task.id,
      request: buildTaskUpdateRequest(task, { status: nextStatus }),
    })
  }

  function handleFinishConfirm() {
    mutate({
      id: task.id,
      request: buildTaskUpdateRequest(task, {
        status: 'DONE',
        currentDate: getLocalDateString(),
      }),
    })
    setIsFinishDialogOpen(false)
  }

  function canSubmitReopen(): boolean {
    if (reopenUnknown) {
      return true
    }
    const minutes = Number.parseInt(reopenMinutes, 10)
    return Number.isFinite(minutes) && minutes > 0
  }

  function handleReopenConfirm() {
    if (reopenStatus == null || !canSubmitReopen()) {
      return
    }

    mutate({
      id: task.id,
      request: buildTaskUpdateRequest(task, {
        status: reopenStatus,
        currentDate: getLocalDateString(),
        remainingEffortMinutes: reopenUnknown
          ? null
          : Number.parseInt(reopenMinutes, 10),
      }),
    })
    setIsReopenDialogOpen(false)
    setReopenStatus(null)
  }

  function handleDeleteConfirm() {
    onDelete(task)
    setIsDeleteDialogOpen(false)
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {conflictMessage ? (
        <Alert className="max-w-xs">
          <AlertDescription>{conflictMessage}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex items-center gap-2">
      <select
        aria-label={`Change status for ${task.title}`}
        value={task.status}
        disabled={isDisabled}
        onChange={(event) =>
          handleStatusChange(event.target.value as TaskStatus)
        }
        className="h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {TASK_STATUSES.map((status) => (
          <option
            key={status}
            value={status}
            disabled={status === 'OPEN' && !canReturnToOpen(task)}
          >
            {STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Task actions for ${task.title}`}
              disabled={isDisabled}
            />
          }
        >
          <MoreHorizontalIcon className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(task)}>Edit</DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={isFinishDialogOpen} onOpenChange={setIsFinishDialogOpen}>
        <AlertDialogContent aria-label="Finish task">
          <AlertDialogHeader>
            <AlertDialogTitle>Finish task</AlertDialogTitle>
            <AlertDialogDescription>
              Mark &quot;{task.title}&quot; as done and set remaining effort to
              zero.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdating}
              onClick={handleFinishConfirm}
            >
              Finish task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isReopenDialogOpen}
        onOpenChange={(open) => {
          setIsReopenDialogOpen(open)
          if (!open) {
            setReopenStatus(null)
          }
        }}
      >
        <AlertDialogContent aria-label="Reopen task">
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen task</AlertDialogTitle>
            <AlertDialogDescription>
              Reopening &quot;{task.title}&quot; requires a fresh remaining
              effort assessment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-3 px-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor={`reopen-minutes-${task.id}`}>
                Remaining effort minutes
              </Label>
              <Input
                id={`reopen-minutes-${task.id}`}
                type="number"
                min={1}
                value={reopenMinutes}
                disabled={reopenUnknown}
                onChange={(event) => setReopenMinutes(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label="Remaining effort is unknown"
                checked={reopenUnknown}
                onChange={(event) => setReopenUnknown(event.target.checked)}
              />
              Remaining effort is unknown
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdating || !canSubmitReopen()}
              onClick={handleReopenConfirm}
            >
              Reopen task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent aria-label="Delete task">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete task</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{task.title}&quot;. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDeleteConfirm}
            >
              Delete task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  )
}
