import { useEffect, useState, type FormEvent } from 'react'

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
import {
  useCommitments,
  useCreateCommitment,
  useDeleteCommitment,
  useUpdateCommitment,
} from '@/features/commitments/hooks'
import { ApiError } from '@/lib/api'
import type { CommitmentResponse } from '@/types/api'

type CommitmentListProps = {
  planDate: string
}

type CommitmentFormState = {
  title: string
  commitmentDate: string
  startTime: string
  endTime: string
}

function toTimeInputValue(apiTime: string): string {
  return apiTime.slice(0, 5)
}

function toApiTime(timeInput: string): string {
  if (timeInput.length === 5) {
    return `${timeInput}:00`
  }
  return timeInput
}

function getFieldError(
  error: Error | null,
  fieldName: string,
): string | undefined {
  if (!(error instanceof ApiError) || !error.details) {
    return undefined
  }
  return error.details[fieldName]?.[0]
}

function emptyFormState(planDate: string): CommitmentFormState {
  return {
    title: '',
    commitmentDate: planDate,
    startTime: '10:00',
    endTime: '11:00',
  }
}

export function CommitmentList({ planDate }: CommitmentListProps) {
  const { commitments, isPending, isError, error: loadError } =
    useCommitments(planDate)
  const createMutation = useCreateCommitment(planDate)
  const updateMutation = useUpdateCommitment(planDate)
  const deleteMutation = useDeleteCommitment(planDate)

  const [formState, setFormState] = useState<CommitmentFormState>(() =>
    emptyFormState(planDate),
  )
  const [editingCommitment, setEditingCommitment] =
    useState<CommitmentResponse | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CommitmentResponse | null>(
    null,
  )

  useEffect(() => {
    setFormState(emptyFormState(planDate))
    setEditingCommitment(null)
  }, [planDate])

  const activeMutation = editingCommitment ? updateMutation : createMutation
  const saveError = activeMutation.error

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const request = {
      title: formState.title,
      commitmentDate: formState.commitmentDate,
      startTime: toApiTime(formState.startTime),
      endTime: toApiTime(formState.endTime),
    }

    if (editingCommitment) {
      updateMutation.mutate(
        { id: editingCommitment.id, request },
        {
          onSuccess: () => {
            setEditingCommitment(null)
            setFormState(emptyFormState(planDate))
          },
        },
      )
      return
    }

    createMutation.mutate(request, {
      onSuccess: () => {
        setFormState(emptyFormState(planDate))
      },
    })
  }

  function startEdit(commitment: CommitmentResponse) {
    setEditingCommitment(commitment)
    setFormState({
      title: commitment.title,
      commitmentDate: commitment.commitmentDate,
      startTime: toTimeInputValue(commitment.startTime),
      endTime: toTimeInputValue(commitment.endTime),
    })
  }

  function cancelEdit() {
    setEditingCommitment(null)
    setFormState(emptyFormState(planDate))
  }

  function confirmDelete() {
    if (deleteTarget == null) {
      return
    }

    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    })
  }

  if (isPending) {
    return <p>Loading commitments…</p>
  }

  if (isError && loadError instanceof Error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{loadError.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-medium">Commitments</h2>
        <p className="text-sm text-muted-foreground">
          Fixed-time blocks for {planDate}.
        </p>
      </div>

      {activeMutation.isError && saveError instanceof Error ? (
        <Alert variant="destructive">
          <AlertDescription>{saveError.message}</AlertDescription>
        </Alert>
      ) : null}

      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="commitment-title">Title</Label>
          <Input
            id="commitment-title"
            value={formState.title}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
            aria-invalid={Boolean(getFieldError(saveError, 'title'))}
            required
          />
          {activeMutation.isError && getFieldError(saveError, 'title') ? (
            <p className="text-sm text-destructive">
              {getFieldError(saveError, 'title')}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="commitment-date">Date</Label>
          <Input
            id="commitment-date"
            type="date"
            value={formState.commitmentDate}
            onChange={(event) =>
              setFormState((current) => ({
                ...current,
                commitmentDate: event.target.value,
              }))
            }
            required
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="commitment-start">Start</Label>
            <Input
              id="commitment-start"
              type="time"
              value={formState.startTime}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  startTime: event.target.value,
                }))
              }
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="commitment-end">End</Label>
            <Input
              id="commitment-end"
              type="time"
              value={formState.endTime}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  endTime: event.target.value,
                }))
              }
              required
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={activeMutation.isPending}>
            {editingCommitment ? 'Save commitment' : 'Add commitment'}
          </Button>
          {editingCommitment ? (
            <Button type="button" variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {commitments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No commitments for this date yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {commitments.map((commitment) => (
            <li
              key={commitment.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p className="font-medium">{commitment.title}</p>
                <p className="text-sm text-muted-foreground">
                  {toTimeInputValue(commitment.startTime)}–
                  {toTimeInputValue(commitment.endTime)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => startEdit(commitment)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteTarget(commitment)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent aria-label="Delete commitment">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete commitment</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.title ?? 'this commitment'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Delete commitment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
