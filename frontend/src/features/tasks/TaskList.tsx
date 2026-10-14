import { CalendarIcon, CircleDotIcon, ClockIcon, FlagIcon, ListTodoIcon } from 'lucide-react'

import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RemainingEffortControl } from '@/features/tasks/RemainingEffortControl'
import { TaskActions } from '@/features/tasks/TaskActions'
import { PriorityBadge } from '@/features/tasks/PriorityBadge'
import { StatusBadge } from '@/features/tasks/StatusBadge'
import { TaskMetaItem } from '@/features/tasks/TaskMetaItem'
import { deadlineBadgeLabel } from '@/features/horizon/horizonGrid'
import { useHorizon } from '@/features/horizon/hooks'
import { useDeleteTask, useTasks } from '@/features/tasks/hooks'
import {
  countActiveBlockedBy,
  countActiveBlocks,
} from '@/features/tasks/taskDependencyLinks'
import type { DeadlineStatus, TaskResponse } from '@/types/api'

function formatDueDate(dueDate: string | null): string {
  return dueDate ?? 'No due date'
}

function formatEstimatedMinutes(minutes: number | null): string {
  return minutes != null ? `${minutes} min` : 'No estimate'
}

function formatRemainingEffort(minutes: number | null): string {
  if (minutes == null) {
    return 'Unknown remaining'
  }
  return `${minutes} min remaining`
}

type TaskRowProps = {
  task: TaskResponse
  deadlineBadge: string | null
  deadlineStatus: DeadlineStatus | null | undefined
  onEditTask: (task: TaskResponse) => void
  onDelete: (task: TaskResponse) => void
  isDeleting: boolean
}

function TaskRow({
  task,
  deadlineBadge,
  deadlineStatus,
  onEditTask,
  onDelete,
  isDeleting,
}: TaskRowProps) {
  const blockedByCount = countActiveBlockedBy(task)
  const blocksCount = countActiveBlocks(task)

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2 py-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-medium">{task.title}</h3>
          <TaskActions
            task={task}
            onEdit={onEditTask}
            onDelete={onDelete}
            isDeleting={isDeleting}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <TaskMetaItem category="priority" icon={FlagIcon}>
            <PriorityBadge priority={task.priority} />
          </TaskMetaItem>
          <TaskMetaItem category="status" icon={CircleDotIcon}>
            <StatusBadge status={task.status} />
          </TaskMetaItem>
          <TaskMetaItem category="dueDate" icon={CalendarIcon}>
            {formatDueDate(task.dueDate)}
          </TaskMetaItem>
          <TaskMetaItem category="estimatedMinutes" icon={ClockIcon}>
            {formatEstimatedMinutes(task.estimatedMinutes)}
          </TaskMetaItem>
          <TaskMetaItem category="remainingEffortMinutes" icon={ClockIcon}>
            {formatRemainingEffort(task.remainingEffortMinutes)}
          </TaskMetaItem>
          {deadlineBadge != null ? (
            <TaskMetaItem category="status" icon={CircleDotIcon}>
              <Badge
                variant={deadlineStatus === 'AT_RISK' ? 'secondary' : 'destructive'}
              >
                {deadlineBadge}
              </Badge>
            </TaskMetaItem>
          ) : null}
          <RemainingEffortControl task={task} />
        </div>
        {blockedByCount > 0 ? (
          <p className="text-sm text-muted-foreground">
            Blocked by {blockedByCount}
          </p>
        ) : null}
        {blocksCount > 0 ? (
          <p className="text-sm text-muted-foreground">Blocks {blocksCount}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function TaskListSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading tasks"
      className="flex flex-col gap-3"
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <Skeleton
          key={index}
          data-testid="task-skeleton-row"
          className="h-20 w-full rounded-xl"
        />
      ))}
    </div>
  )
}

function TaskListEmpty({ onCreateTask }: { onCreateTask: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <ListTodoIcon className="size-8 text-muted-foreground" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">No tasks yet</p>
        <p className="text-sm text-muted-foreground">
          Click New Task to create your first one.
        </p>
      </div>
      <Button type="button" onClick={onCreateTask}>
        New Task
      </Button>
    </div>
  )
}

type TaskListProps = {
  onEditTask?: (task: TaskResponse) => void
  onCreateTask?: () => void
}

export function TaskList({
  onEditTask = () => undefined,
  onCreateTask = () => undefined,
}: TaskListProps) {
  const { isPending, isError, isEmpty, tasks, error, refetch } = useTasks()
  const {
    horizon,
    isError: isHorizonError,
    refetch: refetchHorizon,
  } = useHorizon()
  const { mutate: deleteTask, isPending: isDeleting } = useDeleteTask()

  const horizonRowByTaskId = new Map(
    (horizon?.tasks ?? []).map((row) => [row.taskId, row]),
  )

  function handleDelete(task: TaskResponse) {
    deleteTask(task.id)
  }

  if (isPending) {
    return <TaskListSkeleton />
  }

  if (isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load tasks</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Something went wrong'}
        </AlertDescription>
        <AlertAction>
          <Button type="button" size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  if (isEmpty) {
    return <TaskListEmpty onCreateTask={onCreateTask} />
  }

  return (
    <div className="flex flex-col gap-3">
      {isHorizonError ? (
        <Alert>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Deadline forecast unavailable</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => refetchHorizon()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {tasks.map((task) => {
        const horizonRow = horizonRowByTaskId.get(task.id)
        const deadlineBadge =
          horizonRow != null
            ? deadlineBadgeLabel(
                horizonRow.deadlineStatus,
                horizonRow.unresolvedEffort,
              )
            : null

        return (
          <TaskRow
            key={task.id}
            task={task}
            deadlineBadge={deadlineBadge}
            deadlineStatus={horizonRow?.deadlineStatus}
            onEditTask={onEditTask}
            onDelete={handleDelete}
            isDeleting={isDeleting}
          />
        )
      })}
    </div>
  )
}
