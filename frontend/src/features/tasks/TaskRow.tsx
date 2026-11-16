import { LinkIcon } from 'lucide-react'

import { DeadlineBadge } from '@/features/horizon/DeadlineBadge'
import { StatusBadge } from '@/features/tasks/StatusBadge'
import { TaskActions } from '@/features/tasks/TaskActions'
import { PRIORITY_LABELS } from '@/features/tasks/labels'
import {
  countActiveBlockedBy,
  countActiveBlocks,
  waitingOnLabel,
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

const FLAG_FILL_PATHS: Record<TaskResponse['priority'], { fill: 'full' | 'half' | 'empty'; d: string | null }> = {
  HIGH: { fill: 'full', d: 'M3.5 3h9l-2.2 3.5L12.5 10h-9z' },
  MEDIUM: { fill: 'half', d: 'M3.5 6.5h6.8L12.5 10h-9z' },
  LOW: { fill: 'empty', d: null },
}

function PriorityFlag({ priority }: { priority: TaskResponse['priority'] }) {
  const { fill, d } = FLAG_FILL_PATHS[priority]
  return (
    <span className={cn('inline-flex', PRIORITY_CLASSES[priority])} data-fill={fill}>
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {d != null ? <path d={d} fill="currentColor" stroke="none" /> : null}
        <path d="M3.5 14V2.5" />
        <path d="M3.5 3h9l-2.2 3.5L12.5 10h-9" />
      </svg>
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

function ForecastBadge({
  horizonRow,
}: {
  horizonRow: HorizonTaskRowResponse | undefined
}) {
  if (horizonRow == null || horizonRow.deadlineStatus == null) {
    return <span className="text-muted-foreground">—</span>
  }
  return (
    <DeadlineBadge
      deadlineStatus={horizonRow.deadlineStatus}
      unresolvedEffort={horizonRow.unresolvedEffort}
    />
  )
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
  const waiting = waitingOnLabel(task)

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
            <ForecastBadge horizonRow={horizonRow} />
            <span className="font-mono text-xs text-muted-foreground">
              Due {task.dueDate != null ? formatDateLabel(task.dueDate) : '—'}
            </span>
          </div>
          <span className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {facts}
          </span>
          {waiting != null ? (
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <LinkIcon className="size-3" aria-hidden="true" />
              {waiting}
            </p>
          ) : null}
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
      className={cn('border-t border-border transition-colors first:border-t-0 hover:bg-accent', statusClasses)}
    >
      <td className="w-7 px-3 py-2">
        <PriorityFlag priority={task.priority} />
      </td>
      <td className="px-3 py-2">
        {titleButton}
        {waiting != null ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <LinkIcon className="size-3" aria-hidden="true" />
            {waiting}
          </p>
        ) : null}
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
        <ForecastBadge horizonRow={horizonRow} />
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
