import { FlagIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { PRIORITY_LABELS } from '@/features/tasks/labels'
import type { TaskPriority } from '@/types/api'

const PRIORITY_TONES: Record<TaskPriority, string> = {
  LOW: 'text-priority-low',
  MEDIUM: 'text-priority-medium',
  HIGH: 'text-priority-high',
}

type PriorityBadgeProps = {
  priority: TaskPriority
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={`h-5 gap-1 rounded-sm bg-card ${PRIORITY_TONES[priority]}`}
      data-priority={priority}
    >
      <FlagIcon className="size-3" aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </Badge>
  )
}
