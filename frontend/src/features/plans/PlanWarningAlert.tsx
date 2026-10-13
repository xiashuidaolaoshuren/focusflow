import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  formatWaitingOn,
  type SnapshotTitleInfo,
} from '@/features/plans/planSnapshotCopy'
import type { DailyPlanWarning } from '@/types/api'

type PlanWarningAlertProps = {
  warning: DailyPlanWarning
  snapshotTitles: Map<number, SnapshotTitleInfo>
}

function buildLeadSentence(warning: DailyPlanWarning): string {
  const hasUnestimated = warning.unestimatedTasks.length > 0
  const hasOutOfTime = warning.outOfTimeTasks.length > 0
  const hasBlocked = warning.blockedTasks.length > 0
  const timeExceeded = warning.requiredMinutes > warning.freeMinutes

  if (hasBlocked && !hasOutOfTime && !hasUnestimated) {
    return 'Some must-include tasks are waiting on other work before they can be scheduled.'
  }

  if (timeExceeded && hasUnestimated) {
    return `Must-include tasks need ${warning.requiredMinutes} min of focus time, but only ${warning.freeMinutes} min were free, and some have unknown duration.`
  }
  if (timeExceeded) {
    return `Must-include tasks need ${warning.requiredMinutes} min of focus time, but only ${warning.freeMinutes} min were free for this plan.`
  }
  if (hasUnestimated) {
    return 'Some must-include tasks have unknown duration, so the total focus time needed is uncertain.'
  }
  return `Must-include tasks need ${warning.requiredMinutes} min of focus time for this plan.`
}

export function PlanWarningAlert({
  warning,
  snapshotTitles,
}: PlanWarningAlertProps) {
  return (
    <Alert variant="default" className="mb-3">
      <AlertTitle>Plan needs more focus time</AlertTitle>
      <AlertDescription>
        <p>{buildLeadSentence(warning)}</p>
        <ul className="mt-1 list-disc pl-4">
          {warning.outOfTimeTasks.map((task) => (
            <li key={task.sourceTaskId}>
              {task.title} — {task.unplacedMinutes} min unplaced
            </li>
          ))}
          {warning.unestimatedTasks.map((task) => (
            <li key={task.sourceTaskId}>{task.title} — unknown duration</li>
          ))}
          {warning.blockedTasks.map((task) => (
            <li key={task.sourceTaskId}>
              {task.title}: Waiting on{' '}
              {formatWaitingOn(task.blockerSourceTaskIds, snapshotTitles)}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
