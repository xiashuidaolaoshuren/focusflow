import { FlagIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/features/tasks/StatusBadge'
import { TaskActions } from '@/features/tasks/TaskActions'
import { PRIORITY_LABELS } from '@/features/tasks/labels'
import {
  countActiveBlockedBy,
  countActiveBlocks,
} from '@/features/tasks/taskDependencyLinks'
import { formatDateLabel } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { HorizonTaskRowResponse, TaskResponse } from '@/types/api'

const PRIORITY_CLASSES: Record<TaskResponse['priority'], string> = {
  HIGH: 'text-priority-high',
  MEDIUM: 'text-priority-medium',
  LOW: 'text-priority-low',
}

type TaskRowProps = {
  task: TaskResponse
  horizonRow: HorizonTaskRowResponse | undefined
  neededFor: string | null
  variant?: 'row' | 'card'
  onEdit: (task: TaskResponse) => void
  onDelete: (task: TaskResponse) => void
  isDeleting: boolean
}

function PriorityFlag({ priority }: { priority: TaskResponse['priority'] }) {
  return (
    <span className={cn('inline-flex', PRIORITY_CLASSES[priority])}>
      <FlagIcon className="size-4" aria-hidden="true" />
      <span className="sr-only">{PRIORITY_LABELS[priority]} priority</span>
    </span>
  )
}

function EffortCell({ task }: { task: TaskResponse }) {
  if (task.remainingEffortMinutes == null) {
    return (
      <span className="flex flex-col items-end whitespace-nowrap">
        <span className="font-mono text-sm">—</span>
        <span className="text-xs text-muted-foreground">No estimate</span>
      </span>
    )
  }
  return (
    <span className="flex flex-col items-end whitespace-nowrap">
      <span className="font-mono text-sm">{task.remainingEffortMinutes}m</span>
      <span className="text-xs text-muted-foreground">
        {task.estimatedMinutes != null
          ? `of ${task.estimatedMinutes}m`
          : 'No estimate'}
      </span>
    </span>
  )
}

function DeadlineBadge({
  horizonRow,
}: {
  horizonRow: HorizonTaskRowResponse | undefined
}) {
  if (horizonRow == null) {
    return <span className="text-muted-foreground">—</span>
  }
  switch (horizonRow.deadlineStatus) {
    case 'AT_RISK':
      return <Badge variant="secondary">At risk</Badge>
    case 'OVERDUE':
      return <Badge variant="destructive">Overdue</Badge>
    case 'CANNOT_FORECAST':
      return (
        <Badge variant="outline">
          {horizonRow.unresolvedEffort.length > 0
            ? `Cannot forecast: ${horizonRow.unresolvedEffort
                .map((ref) => ref.title)
                .join(', ')}`
            : 'Cannot forecast'}
        </Badge>
      )
    default:
      return <span className="text-muted-foreground">—</span>
  }
}

export function TaskRow({
  task,
  horizonRow,
  neededFor,
  variant = 'row',
  onEdit,
  onDelete,
  isDeleting,
}: TaskRowProps) {
  const blockedBy = countActiveBlockedBy(task)
  const blocks = countActiveBlocks(task)

  const statusClasses =
    task.status === 'CANCELLED'
      ? '[&_.task-title]:text-muted-foreground [&_.task-title]:line-through'
      : task.status === 'DONE'
        ? '[&_.task-title]:text-muted-foreground'
        : ''

  const titleButton = (
    <button
      type="button"
      className="task-title text-left text-sm font-medium outline-none hover:underline hover:underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => onEdit(task)}
    >
      {task.title}
    </button>
  )

  const actions = (
    <TaskActions
      task={task}
      onEdit={onEdit}
      onDelete={onDelete}
      isDeleting={isDeleting}
    />
  )

  const facts = (
    <>
      <span className="flex gap-2">
        {blockedBy > 0 ? <span>Blocked by {blockedBy}</span> : null}
        {blocks > 0 ? <span>Blocks {blocks}</span> : null}
        {blockedBy === 0 && blocks === 0 ? <span>—</span> : null}
      </span>
    </>
  )

  if (variant === 'card') {
    return (
      <li
        className={cn(
          'flex gap-3 border-t border-border px-4 py-3 first:border-t-0',
          statusClasses,
        )}
      >
        <span className="pt-0.5">
          <PriorityFlag priority={task.priority} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {titleButton}
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <DeadlineBadge horizonRow={horizonRow} />
            <span className="font-mono text-xs text-muted-foreground">
              Due {task.dueDate != null ? formatDateLabel(task.dueDate) : '—'}
            </span>
          </div>
          <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {facts}
          </span>
          {neededFor != null ? (
            <p className="text-xs text-muted-foreground">{neededFor}</p>
          ) : null}
        </div>
        <div className="flex flex-none flex-col items-end gap-1">
          <EffortCell task={task} />
          {actions}
        </div>
      </li>
    )
  }

  return (
    <tr
      className={cn('transition-colors hover:bg-accent', statusClasses)}
    >
      <td className="w-7 px-3 py-2">
        <PriorityFlag priority={task.priority} />
      </td>
      <td className="px-3 py-2">
        {titleButton}
        {neededFor != null ? (
          <p className="text-xs text-muted-foreground">{neededFor}</p>
        ) : null}
      </td>
      <td className="px-3 py-2">
        <StatusBadge status={task.status} />
      </td>
      <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted-foreground">
        {task.dueDate != null ? formatDateLabel(task.dueDate) : '—'}
      </td>
      <td className="px-3 py-2">
        <DeadlineBadge horizonRow={horizonRow} />
      </td>
      <td className="px-3 py-2 text-right">
        <EffortCell task={task} />
      </td>
      <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">
        {facts}
      </td>
      <td className="px-3 py-2">{actions}</td>
    </tr>
  )
}
