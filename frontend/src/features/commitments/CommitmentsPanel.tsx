import { useRef, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { TimeField } from '@/components/form/TimeField'
import {
  commitmentSchema,
  type CommitmentFormValues,
} from '@/components/form/schemas'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
} from '@/features/commitments/hooks'
import { ApiError } from '@/lib/api'
import { formatClock } from '@/lib/format'
import type { CommitmentResponse } from '@/types/api'

type CommitmentsPanelProps = {
  planDate: string
}

function emptyValues(planDate: string): CommitmentFormValues {
  return {
    title: '',
    commitmentDate: planDate,
    startTime: '15:00',
    endTime: '15:30',
  }
}

function toApiTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time
}

function toFormTime(apiTime: string): string {
  return apiTime.slice(0, 5)
}

export function CommitmentsPanel({ planDate }: CommitmentsPanelProps) {
  const { commitments } = useCommitments(planDate)
  const createMutation = useCreateCommitment(planDate)
  const updateMutation = useUpdateCommitment(planDate)
  const deleteMutation = useDeleteCommitment(planDate)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<CommitmentResponse | null>(null)
  const [deleting, setDeleting] = useState<CommitmentResponse | null>(null)
  const rowDeleteButtons = useRef(new Map<number, HTMLButtonElement>())

  const form = useForm<CommitmentFormValues>({
    resolver: zodResolver(commitmentSchema),
    defaultValues: emptyValues(planDate),
  })

  const formOpen = adding || editing != null
  const savePending = createMutation.isPending || updateMutation.isPending
  const saveError = editing ? updateMutation.error : createMutation.error
  // Errors without field details (for example an overlap) have no field to sit on.
  const formLevelError =
    saveError instanceof Error &&
    !(saveError instanceof ApiError && saveError.details)
      ? saveError
      : null

  function closeForm() {
    setAdding(false)
    setEditing(null)
  }

  const submit = form.handleSubmit((values) => {
    if (editing) {
      updateMutation.mutate(
        {
          id: editing.id,
          request: {
            title: values.title,
            // An edit keeps the commitment's own date; the form has no date field.
            commitmentDate: editing.commitmentDate,
            startTime: toApiTime(values.startTime),
            endTime: toApiTime(values.endTime),
          },
        },
        { onSuccess: closeForm },
      )
      return
    }

    createMutation.mutate(
      {
        title: values.title,
        commitmentDate: planDate,
        startTime: toApiTime(values.startTime),
        endTime: toApiTime(values.endTime),
      },
      { onSuccess: closeForm },
    )
  })

  function openAdd() {
    form.reset(emptyValues(planDate))
    setEditing(null)
    setAdding(true)
  }

  function confirmDelete(commitment: CommitmentResponse) {
    deleteMutation.mutate(commitment.id, {
      onSuccess: () => setDeleting(null),
    })
  }

  function cancelDelete(commitment: CommitmentResponse) {
    setDeleting(null)
    rowDeleteButtons.current.get(commitment.id)?.focus()
  }

  function startEdit(commitment: CommitmentResponse) {
    form.reset({
      title: commitment.title,
      commitmentDate: commitment.commitmentDate,
      startTime: toFormTime(commitment.startTime),
      endTime: toFormTime(commitment.endTime),
    })
    setAdding(false)
    setEditing(commitment)
  }

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-base leading-5 font-semibold">Commitments</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {commitments.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={openAdd}
        >
          <PlusIcon aria-hidden="true" />
          Add
        </Button>
      </div>

      {formOpen ? (
        <form className="grid gap-3 border-b border-border p-4" onSubmit={submit}>
          {formLevelError ? (
            <Alert variant="destructive">
              <AlertDescription>{formLevelError.message}</AlertDescription>
            </Alert>
          ) : null}
          <Field
            label="Title"
            required
            name="title"
            error={form.formState.errors.title?.message}
            apiError={saveError}
          >
            {(control) => (
              <Input {...form.register('title')} {...control} maxLength={255} />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Start"
              name="startTime"
              error={form.formState.errors.startTime?.message}
              apiError={saveError}
            >
              {(control) => (
                <Controller
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <TimeField
                      {...control}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </Field>
            <Field
              label="End"
              name="endTime"
              error={form.formState.errors.endTime?.message}
              apiError={saveError}
            >
              {(control) => (
                <Controller
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <TimeField
                      {...control}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              )}
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={savePending}>
              Save commitment
            </Button>
          </div>
        </form>
      ) : null}

      {commitments.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No Commitments today</p>
      ) : (
        <ul>
          {commitments.map((commitment) => (
            <li
              key={commitment.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span
                aria-hidden="true"
                className="h-7 w-[3px] shrink-0 rounded-sm bg-block-commitment"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{commitment.title}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {formatClock(commitment.startTime)}–{formatClock(commitment.endTime)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Edit ${commitment.title}`}
                onClick={() => startEdit(commitment)}
              >
                <PencilIcon aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete ${commitment.title}`}
                ref={(node) => {
                  if (node) {
                    rowDeleteButtons.current.set(commitment.id, node)
                  } else {
                    rowDeleteButtons.current.delete(commitment.id)
                  }
                }}
                onClick={() => setDeleting(commitment)}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
              {deleting?.id === commitment.id ? (
                <div
                  role="group"
                  aria-label={`Confirm delete ${commitment.title}`}
                  className="flex w-full items-center justify-end gap-2 rounded-md bg-secondary px-3 py-2 text-sm"
                >
                  <span className="mr-auto">Delete {commitment.title}?</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => cancelDelete(commitment)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={deleteMutation.isPending}
                    onClick={() => confirmDelete(commitment)}
                  >
                    Delete
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
