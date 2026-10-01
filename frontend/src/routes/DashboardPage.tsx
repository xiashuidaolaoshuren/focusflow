import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CommitmentList } from '@/features/commitments/CommitmentList'
import { DailyPlanView } from '@/features/plans/DailyPlanView'
import { GeneratePlanCard } from '@/features/plans/GeneratePlanCard'
import { usePlanByDate } from '@/features/plans/hooks'
import { useRegeneratePrompt } from '@/features/plans/regeneratePrompt'
import { TaskForm, TaskFormSubmitButton } from '@/features/tasks/TaskForm'
import { TaskList } from '@/features/tasks/TaskList'
import { resolvePlanningDate } from '@/lib/planningDate'
import type { TaskResponse } from '@/types/api'

export function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskResponse | null>(null)

  const planningDate = resolvePlanningDate(searchParams.get('date'))
  const { plan, isPending, isError, refetch, hasPlan } =
    usePlanByDate(planningDate)
  const { needed: regenerateNeeded, dismiss: dismissRegeneratePrompt } =
    useRegeneratePrompt()

  useEffect(() => {
    if (searchParams.get('date') !== planningDate) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.set('date', planningDate)
      setSearchParams(nextParams, { replace: true })
    }
  }, [planningDate, searchParams, setSearchParams])

  function openCreateSheet() {
    setEditingTask(null)
    setIsTaskSheetOpen(true)
  }

  function openEditSheet(task: TaskResponse) {
    setEditingTask(task)
    setIsTaskSheetOpen(true)
  }

  function closeTaskSheet() {
    setIsTaskSheetOpen(false)
    setEditingTask(null)
  }

  function handleSheetOpenChange(open: boolean) {
    setIsTaskSheetOpen(open)
    if (!open) {
      setEditingTask(null)
    }
  }

  function handlePlanningDateChange(value: string) {
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('date', value)
    setSearchParams(nextParams)
  }

  const isEditMode = editingTask != null

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Review your tasks and prepare for daily planning.
            </p>
          </div>
          <Button type="button" onClick={openCreateSheet}>
            New Task
          </Button>
        </div>
        <TaskList onEditTask={openEditSheet} onCreateTask={openCreateSheet} />
      </section>

      <Sheet open={isTaskSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{isEditMode ? 'Edit task' : 'New task'}</SheetTitle>
            <SheetDescription>
              {isEditMode
                ? 'Update task details and status.'
                : 'Add a task to your list and prepare it for planning.'}
            </SheetDescription>
          </SheetHeader>
          {isEditMode ? (
            <TaskForm task={editingTask} onSuccess={closeTaskSheet} />
          ) : (
            <TaskForm onSuccess={closeTaskSheet} />
          )}
          <SheetFooter>
            <TaskFormSubmitButton isEditMode={isEditMode} />
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <aside className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="planning-date">Planning date</Label>
          <Input
            id="planning-date"
            type="date"
            value={planningDate}
            onChange={(event) => handlePlanningDateChange(event.target.value)}
          />
        </div>

        {regenerateNeeded && hasPlan ? (
          <Alert>
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>Regenerate to apply changes.</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={dismissRegeneratePrompt}
              >
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <GeneratePlanCard planDate={planningDate} />
        <CommitmentList planDate={planningDate} />
        <DailyPlanView
          plan={plan}
          title={`Plan for ${planningDate}`}
          emptyDescription={`No plan for ${planningDate} yet.`}
          isPending={isPending}
          isError={isError}
          onRetry={refetch}
        />
      </aside>
    </div>
  )
}
