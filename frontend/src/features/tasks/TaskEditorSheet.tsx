import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { DateField } from '@/components/form/DateField'
import {
  taskFormSchema,
  type TaskFormValues,
} from '@/components/form/schemas'
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
import { Label } from '@/components/ui/label'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { RemainingEffortControl } from '@/features/tasks/RemainingEffortControl'
import { dependencyErrorMessage } from '@/features/tasks/dependencyCopy'
import { STATUS_LABELS } from '@/features/tasks/labels'
import {
  formUpdateTaskMutationKey,
  useAddBlocker,
  useCreateTask,
  useRemoveBlocker,
  useTasks,
  useUpdateTask,
} from '@/features/tasks/hooks'
import { canReturnToOpen, hasVisibleProgress } from '@/features/tasks/taskEffort'
import {
  PROGRESS_CONFLICT_MESSAGE,
  isProgressConflict,
} from '@/features/tasks/taskEffortConflict'
import type { TaskResponse, TaskStatus } from '@/types/api'

const PRIORITY_OPTIONS: { value: TaskFormValues['priority']; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

const EDITABLE_STATUSES: TaskStatus[] = ['OPEN', 'IN_PROGRESS']

type TaskEditorSheetProps = {
  open: boolean
  task: TaskResponse | null
  onOpenChange: (open: boolean) => void
}

function toFormValues(task: TaskResponse | null): TaskFormValues {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    priority: task?.priority ?? 'MEDIUM',
    ...(task != null ? { status: task.status } : {}),
    dueDate: task?.dueDate ?? '',
    estimatedMinutes:
      task?.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
  }
}

function statusOptions(task: TaskResponse | null): TaskStatus[] {
  if (task == null || EDITABLE_STATUSES.includes(task.status)) {
    return EDITABLE_STATUSES
  }
  return [...EDITABLE_STATUSES, task.status]
}

/**
 * The right-side Task editor: one form for creating and editing, with blockers managed
 * beside the task fields.
 */
export function TaskEditorSheet({ open, task, onOpenChange }: TaskEditorSheetProps) {
  const isEdit = task != null
  const { tasks } = useTasks()
  const createMutation = useCreateTask()
  const addBlockerMutation = useAddBlocker()
  const removeBlockerMutation = useRemoveBlocker()
  const [selectedBlockerId, setSelectedBlockerId] = useState('')
  const [discardOpen, setDiscardOpen] = useState(false)
  const updateMutation = useUpdateTask({
    mutationKey: formUpdateTaskMutationKey,
  })
  const {
    control,
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    mode: 'onBlur',
    defaultValues: toFormValues(task),
  })

  const activeMutation = isEdit ? updateMutation : createMutation
  const conflictMessage = isProgressConflict(updateMutation.error)
    ? PROGRESS_CONFLICT_MESSAGE
    : null
  const apiError = activeMutation.isError ? activeMutation.error : undefined
  const showMutationError =
    activeMutation.isError &&
    activeMutation.error instanceof Error &&
    conflictMessage == null
  const statuses = statusOptions(task)
  const liveTask =
    isEdit && task != null
      ? tasks.find((candidate) => candidate.id === task.id) ?? task
      : null
  const blockedBy = liveTask?.blockedBy ?? []
  const blockerError =
    dependencyErrorMessage(addBlockerMutation.error) ??
    dependencyErrorMessage(removeBlockerMutation.error)
  const blockerCandidates = tasks.filter(
    (candidate) =>
      candidate.id !== task?.id &&
      !blockedBy.some((link) => link.taskId === candidate.id),
  )

  function handleAddBlocker() {
    if (task == null || selectedBlockerId === '') {
      return
    }
    addBlockerMutation.mutate(
      { id: task.id, blockerTaskId: Number.parseInt(selectedBlockerId, 10) },
      { onSuccess: () => setSelectedBlockerId('') },
    )
  }

  function handleRemoveBlocker(blockerId: number) {
    if (task == null) {
      return
    }
    removeBlockerMutation.mutate({ id: task.id, blockerId })
  }

  function requestClose() {
    if (isDirty) {
      setDiscardOpen(true)
      return
    }
    onOpenChange(false)
  }

  function handleSheetOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true)
      return
    }
    requestClose()
  }

  function discardAndClose() {
    setDiscardOpen(false)
    onOpenChange(false)
  }

  function handleSubmitValues(values: TaskFormValues) {
    const payload = {
      title: values.title.trim(),
      description:
        values.description.trim() === '' ? null : values.description.trim(),
      priority: values.priority ?? 'MEDIUM',
      dueDate: values.dueDate.trim() === '' ? null : values.dueDate.trim(),
      estimatedMinutes:
        values.estimatedMinutes.trim() === ''
          ? null
          : Number.parseInt(values.estimatedMinutes, 10),
    }

    if (isEdit && task != null) {
      updateMutation.mutate(
        {
          id: task.id,
          request: {
            ...payload,
            status: values.status ?? task.status,
            ...(hasVisibleProgress(task)
              ? { effortVersion: task.effortVersion }
              : {}),
          },
        },
        {
          onSuccess: () => {
            toast.success('Task saved')
            onOpenChange(false)
          },
        },
      )
      return
    }

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Task created')
        onOpenChange(false)
      },
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-[400px]">
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="font-display text-lg leading-7 font-medium tracking-[-0.01em]">
            {isEdit ? 'Edit task' : 'New task'}
          </SheetTitle>
        </SheetHeader>

        <form
          aria-label="Task details"
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit(handleSubmitValues)}
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
            {conflictMessage != null ? (
              <Alert>
                <AlertDescription>{conflictMessage}</AlertDescription>
              </Alert>
            ) : null}
            {showMutationError && activeMutation.error instanceof Error ? (
              <Alert variant="destructive">
                <AlertDescription>{activeMutation.error.message}</AlertDescription>
              </Alert>
            ) : null}

            <Field
              label="Title"
              required
              name="title"
              error={errors.title?.message}
              apiError={apiError}
            >
              {(control) => (
                <Input
                  {...register('title')}
                  {...control}
                  maxLength={120}
                  autoComplete="off"
                />
              )}
            </Field>

            <Field label="Description" name="description" apiError={apiError}>
              {(control) => (
                <textarea
                  {...register('description')}
                  {...control}
                  rows={3}
                  className="min-h-[74px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              )}
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Priority" name="priority" apiError={apiError}>
                {(control) => (
                  <select
                    {...register('priority')}
                    {...control}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>

              {isEdit ? (
                <Field label="Status" name="status" apiError={apiError}>
                  {(control) => (
                    <select
                      {...register('status')}
                      {...control}
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {statuses.map((status) => (
                        <option
                          key={status}
                          value={status}
                          disabled={
                            status === 'OPEN' &&
                            task != null &&
                            !canReturnToOpen(task)
                          }
                        >
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ) : null}
            </div>

            <div className="flex flex-col gap-1">
              <Label>Remaining effort</Label>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2">
                <span className="font-mono text-base">
                  {isEdit && liveTask != null
                    ? liveTask.remainingEffortMinutes != null
                      ? `${liveTask.remainingEffortMinutes}m`
                      : '—'
                    : 'Starts at the estimate'}
                </span>
                {isEdit && liveTask != null ? (
                  <RemainingEffortControl task={liveTask} />
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Controller
                control={control}
                name="dueDate"
                render={({ field: dueField }) => (
                  <Field
                    label="Due date"
                    name="dueDate"
                    error={errors.dueDate?.message}
                    apiError={apiError}
                  >
                    {(fieldControl) => (
                      <DateField
                        id={fieldControl.id}
                        value={dueField.value}
                        onChange={dueField.onChange}
                        {...(fieldControl['aria-invalid'] != null
                          ? { 'aria-invalid': true as const }
                          : {})}
                        {...(fieldControl['aria-describedby'] != null
                          ? {
                              'aria-describedby':
                                fieldControl['aria-describedby'],
                            }
                          : {})}
                      />
                    )}
                  </Field>
                )}
              />

              <Field
                label="Estimate"
                name="estimatedMinutes"
                error={errors.estimatedMinutes?.message}
                apiError={apiError}
                description="Whole task, in minutes"
              >
                {(fieldControl) => (
                  <Input
                    {...register('estimatedMinutes')}
                    {...fieldControl}
                    type="number"
                    inputMode="numeric"
                    min={1}
                  />
                )}
              </Field>
            </div>

            {isEdit && task != null ? (
              <div className="flex flex-col gap-2">
                <Label>Blocked by</Label>
                {blockedBy.length > 0 ? (
                  <ul className="grid gap-1">
                    {blockedBy.map((link) => (
                      <li
                        key={link.taskId}
                        className="flex items-center gap-2 rounded-md border border-border py-1 pr-1 pl-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {link.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {STATUS_LABELS[link.status]}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Remove ${link.title}`}
                          disabled={removeBlockerMutation.isPending}
                          onClick={() => handleRemoveBlocker(link.taskId)}
                        >
                          ×
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No blockers</p>
                )}
                {blockerError != null ? (
                  <p role="alert" className="text-sm text-destructive">
                    {blockerError}
                  </p>
                ) : null}
                <div className="flex gap-2">
                  <select
                    id="add-blocker"
                    aria-label="Add blocker"
                    value={selectedBlockerId}
                    onChange={(event) => setSelectedBlockerId(event.target.value)}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <option value="">Add a blocker…</option>
                    {blockerCandidates.map((candidate) => (
                      <option key={candidate.id} value={String(candidate.id)}>
                        {candidate.title}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      selectedBlockerId === '' || addBlockerMutation.isPending
                    }
                    onClick={handleAddBlocker}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <SheetFooter className="flex-row justify-end border-t border-border px-5 py-3">
            <Button type="button" variant="ghost" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={activeMutation.isPending}>
              Save
            </Button>
          </SheetFooter>
        </form>

        <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
          <AlertDialogContent aria-label="Discard changes">
            <AlertDialogHeader>
              <AlertDialogTitle>Discard changes?</AlertDialogTitle>
              <AlertDialogDescription>
                This task has unsaved changes. Closing the sheet loses them.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep editing</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={discardAndClose}>
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}
