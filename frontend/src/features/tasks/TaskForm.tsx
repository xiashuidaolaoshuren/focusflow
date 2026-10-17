import { useState, type FormEvent } from 'react'
import { useIsMutating } from '@tanstack/react-query'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
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
import {
  createTaskMutationKey,
  formUpdateTaskMutationKey,
  useAddBlocker,
  useCreateTask,
  useRemoveBlocker,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks'
import { ESTIMATE_LOCK_COPY, canReturnToOpen, hasVisibleProgress } from '@/features/tasks/taskEffort'
import { PROGRESS_CONFLICT_MESSAGE } from '@/features/tasks/taskEffortConflict'
import { ApiError } from '@/lib/api'
import type { TaskPriority, TaskResponse, TaskStatus } from '@/types/api'

const PRIORITY_ITEMS: { value: TaskPriority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

function formatRemainingEffort(minutes: number | null): string {
  if (minutes == null) {
    return 'Unknown remaining'
  }
  return `${minutes} min remaining`
}

const FORM_STATUS_ITEMS: { value: TaskStatus; label: string }[] = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In progress' },
]

function getFieldError(
  error: Error | null,
  fieldName: string,
): string | undefined {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined
  }
  return error.details[fieldName]?.[0]
}

export const TASK_FORM_ID = 'task-form'

type TaskFormProps = {
  onSuccess?: () => void
  onEffortConflict?: () => void
  task?: TaskResponse
}

type TaskFormSubmitButtonProps = {
  isEditMode: boolean
}

export function TaskFormSubmitButton({ isEditMode }: TaskFormSubmitButtonProps) {
  const creating = useIsMutating({ mutationKey: createTaskMutationKey })
  const updating = useIsMutating({ mutationKey: formUpdateTaskMutationKey })
  const isPending = (isEditMode ? updating : creating) > 0

  return (
    <Button type="submit" form={TASK_FORM_ID} className="w-full" disabled={isPending}>
      {isEditMode ? 'Save task' : 'Create task'}
    </Button>
  )
}

const DEPENDENCY_ERROR_CODES = new Set([
  'SELF_DEPENDENCY',
  'DEPENDENCY_EXISTS',
  'DEPENDENCY_CYCLE',
])

export function TaskForm({ onSuccess, onEffortConflict, task }: TaskFormProps) {
  const isEditMode = task != null
  const [conflictMessage, setConflictMessage] = useState<string | null>(null)
  const [selectedBlockerId, setSelectedBlockerId] = useState<string>('')
  const { tasks } = useTasks()
  const addBlockerMutation = useAddBlocker()
  const removeBlockerMutation = useRemoveBlocker()
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'MEDIUM')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'OPEN')
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '')
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    task?.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
  )
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask({
    mutationKey: formUpdateTaskMutationKey,
    onEffortConflict: () => {
      setConflictMessage(PROGRESS_CONFLICT_MESSAGE)
      onEffortConflict?.()
    },
  })
  const isError = isEditMode ? updateMutation.isError : createMutation.isError
  const error = isEditMode ? updateMutation.error : createMutation.error
  const showMutationError =
    isError &&
    error instanceof Error &&
    !(error instanceof ApiError && error.code === 'PROGRESS_CONFLICT')

  const blockerMutationError =
    addBlockerMutation.error ?? removeBlockerMutation.error
  const blockerErrorCode =
    blockerMutationError instanceof ApiError
      ? blockerMutationError.code
      : null
  const showBlockerError =
    blockerErrorCode != null && DEPENDENCY_ERROR_CODES.has(blockerErrorCode)

  const pickerTasks =
    isEditMode && task != null
      ? tasks.filter((candidate) => candidate.id !== task.id)
      : []

  const blockedBy =
    (isEditMode && task != null
      ? tasks.find((candidate) => candidate.id === task.id)?.blockedBy
      : undefined) ??
    task?.blockedBy ??
    []

  function handleAddBlocker() {
    if (task == null || selectedBlockerId === '') {
      return
    }
    addBlockerMutation.mutate(
      { id: task.id, blockerTaskId: Number.parseInt(selectedBlockerId, 10) },
      {
        onSuccess: () => {
          setSelectedBlockerId('')
        },
      },
    )
  }

  function handleRemoveBlocker(blockerId: number) {
    if (task == null) {
      return
    }
    removeBlockerMutation.mutate({ id: task.id, blockerId })
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = {
      title,
      description: description || null,
      priority,
      dueDate: dueDate || null,
      estimatedMinutes:
        estimatedMinutes.trim() === ''
          ? null
          : Number.parseInt(estimatedMinutes, 10),
    }

    if (isEditMode && task) {
      const request = {
        ...payload,
        status,
        ...(hasVisibleProgress(task)
          ? { effortVersion: task.effortVersion }
          : {}),
      }
      updateMutation.mutate({ id: task.id, request }, { onSuccess })
      return
    }

    createMutation.mutate(payload, { onSuccess })
  }

  return (
    <form
      id={TASK_FORM_ID}
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      {conflictMessage ? (
        <Alert>
          <AlertDescription>{conflictMessage}</AlertDescription>
        </Alert>
      ) : null}
      {showMutationError ? (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={Boolean(getFieldError(error, 'title'))}
          aria-describedby={
            getFieldError(error, 'title') ? 'title-error' : undefined
          }
          required
        />
        {isError && getFieldError(error, 'title') ? (
          <p id="title-error" className="text-sm text-destructive">
            {getFieldError(error, 'title')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          name="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={Boolean(getFieldError(error, 'description'))}
          aria-describedby={
            getFieldError(error, 'description') ? 'description-error' : undefined
          }
        />
        {isError && getFieldError(error, 'description') ? (
          <p id="description-error" className="text-sm text-destructive">
            {getFieldError(error, 'description')}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Priority</Label>
        <Select
          value={priority}
          onValueChange={(value) => setPriority(value as TaskPriority)}
        >
          <SelectTrigger aria-label="Priority" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PRIORITY_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      {isEditMode ? (
        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as TaskStatus)}
          >
            <SelectTrigger aria-label="Status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {FORM_STATUS_ITEMS.map((item) => (
                  <SelectItem
                    key={item.value}
                    value={item.value}
                    disabled={
                      item.value === 'OPEN' &&
                      task != null &&
                      !canReturnToOpen(task)
                    }
                  >
                    {item.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="dueDate">Due date</Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          aria-invalid={Boolean(getFieldError(error, 'dueDate'))}
          aria-describedby={
            getFieldError(error, 'dueDate') ? 'dueDate-error' : undefined
          }
        />
        {isError && getFieldError(error, 'dueDate') ? (
          <p id="dueDate-error" className="text-sm text-destructive">
            {getFieldError(error, 'dueDate')}
          </p>
        ) : null}
      </div>
      {isEditMode && task ? (
        <div className="flex flex-col gap-1">
          <Label>Remaining effort</Label>
          <p className="text-sm text-muted-foreground">
            {formatRemainingEffort(task.remainingEffortMinutes)}
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="estimatedMinutes">Estimated minutes</Label>
        <Input
          id="estimatedMinutes"
          name="estimatedMinutes"
          type="number"
          min={1}
          value={estimatedMinutes}
          onChange={(event) => setEstimatedMinutes(event.target.value)}
          aria-invalid={Boolean(getFieldError(error, 'estimatedMinutes'))}
          aria-describedby={
            getFieldError(error, 'estimatedMinutes')
              ? 'estimatedMinutes-error'
              : undefined
          }
        />
        {isError && getFieldError(error, 'estimatedMinutes') ? (
          <p id="estimatedMinutes-error" className="text-sm text-destructive">
            {getFieldError(error, 'estimatedMinutes')}
          </p>
        ) : null}
        {isEditMode && task && hasVisibleProgress(task) ? (
          <p className="text-sm text-muted-foreground">{ESTIMATE_LOCK_COPY}</p>
        ) : null}
      </div>
      {isEditMode && task != null ? (
        <div className="flex flex-col gap-2">
          <Label>Blocked by</Label>
          {blockedBy.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm">
              {blockedBy.map((link) => (
                <li
                  key={link.taskId}
                  className="flex items-center justify-between gap-2"
                >
                  <span>
                    {link.title} ({link.status.replace('_', ' ').toLowerCase()})
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove blocker ${link.title}`}
                    disabled={removeBlockerMutation.isPending}
                    onClick={() => handleRemoveBlocker(link.taskId)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No blockers yet.</p>
          )}
          <Select
            value={selectedBlockerId}
            onValueChange={(value) => setSelectedBlockerId(value ?? '')}
          >
            <SelectTrigger aria-label="Add blocker" className="w-full">
              <SelectValue placeholder="Choose a task to block this one" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {pickerTasks.map((candidate) => (
                  <SelectItem key={candidate.id} value={String(candidate.id)}>
                    {candidate.title}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              selectedBlockerId === '' || addBlockerMutation.isPending
            }
            onClick={handleAddBlocker}
          >
            Add blocker
          </Button>
          {showBlockerError ? (
            <p className="text-sm text-destructive" role="alert">
              {blockerErrorCode}
            </p>
          ) : null}
        </div>
      ) : null}
      </div>
    </form>
  )
}
