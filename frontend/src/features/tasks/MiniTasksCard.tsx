import { InboxIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

import { Badge } from '@/components/ui/badge'
import { InfoPopover } from '@/components/InfoPopover'
import { DeadlineBadge, DeadlineLegend } from '@/features/horizon/DeadlineBadge'
import { PriorityFlag } from '@/features/tasks/TaskRow'
import { StatusBadge } from '@/features/tasks/StatusBadge'
import { miniTaskRows } from '@/features/tasks/miniTasksModel'
import type { HorizonTaskRowResponse, TaskResponse } from '@/types/api'

type MiniTasksCardProps = {
  tasks: TaskResponse[]
  horizonRowByTaskId: Map<number, HorizonTaskRowResponse>
}

function Effort({ task }: { task: TaskResponse }) {
  return (
    <span className="flex-none text-right font-mono text-sm whitespace-nowrap">
      {task.remainingEffortMinutes == null ? '—' : `${task.remainingEffortMinutes}m`}
    </span>
  )
}

/** The compact Tasks card beside the rail: active work, its badges and what is left. */
export function MiniTasksCard({ tasks, horizonRowByTaskId }: MiniTasksCardProps) {
  const rows = miniTaskRows(tasks)

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="text-base leading-5 font-semibold">Tasks</h2>
        <span className="font-mono text-xs text-muted-foreground">{rows.length}</span>
        <Link
          to="/tasks"
          className="ml-auto inline-flex h-8 items-center rounded-md px-2 text-sm font-medium text-foreground outline-none hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          All tasks
        </Link>
        <InfoPopover label="About deadline forecasts" title="Deadline forecast">
          <DeadlineLegend />
        </InfoPopover>
      </div>
      {rows.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">No active tasks</p>
      ) : (
        <ul className="rows" aria-label="Active tasks">
          {rows.map(({ task, unplaced }) => {
            const horizonRow = horizonRowByTaskId.get(task.id)
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 border-t border-border px-4 py-2 first:border-t-0"
              >
                <span className="pt-0.5">
                  <PriorityFlag priority={task.priority} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-sm leading-[18px] font-medium">
                    {task.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={task.status} />
                    {horizonRow != null ? (
                      <DeadlineBadge
                        deadlineStatus={horizonRow.deadlineStatus}
                        unresolvedEffort={horizonRow.unresolvedEffort}
                      />
                    ) : null}
                    {unplaced ? (
                      <Badge variant="outline" className="h-5 gap-1 rounded-sm border-dashed bg-card">
                        <InboxIcon className="size-3" aria-hidden="true" />
                        Unplaced
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <Effort task={task} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
