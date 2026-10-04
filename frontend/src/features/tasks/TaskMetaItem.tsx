import type { LucideIcon } from 'lucide-react'

type TaskMetaCategory =
  | 'priority'
  | 'status'
  | 'dueDate'
  | 'estimatedMinutes'
  | 'remainingEffortMinutes'

type TaskMetaItemProps = {
  category: TaskMetaCategory
  icon: LucideIcon
  children: React.ReactNode
}

export function TaskMetaItem({ category, icon: Icon, children }: TaskMetaItemProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
      data-meta={category}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {children}
    </span>
  )
}

export type { TaskMetaCategory }
