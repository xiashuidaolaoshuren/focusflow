import { CircleCheckIcon, CircleDotIcon, CircleIcon, CircleXIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { STATUS_LABELS } from '@/features/tasks/labels'
import type { TaskStatus } from '@/types/api'

const STATUS_GLYPHS: Record<TaskStatus, { Icon: typeof CircleIcon; tone: string }> = {
  OPEN: { Icon: CircleIcon, tone: 'text-status-open' },
  IN_PROGRESS: { Icon: CircleDotIcon, tone: 'text-status-in-progress' },
  DONE: { Icon: CircleCheckIcon, tone: 'text-status-done' },
  CANCELLED: { Icon: CircleXIcon, tone: 'text-status-cancelled' },
}

type StatusBadgeProps = {
  status: TaskStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { Icon, tone } = STATUS_GLYPHS[status]
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1 rounded-sm bg-card ${tone}`}
      data-status={status}
    >
      <Icon className="size-3" aria-hidden="true" />
      <span className={status === 'CANCELLED' ? 'line-through' : undefined}>
        {STATUS_LABELS[status]}
      </span>
    </Badge>
  )
}
