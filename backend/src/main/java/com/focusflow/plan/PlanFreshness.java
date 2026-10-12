package com.focusflow.plan;

import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import java.util.Objects;

/**
 * Whether a plan's captured effort assumptions still match the live Tasks.
 *
 * <p>A revision is stale when one of its snapshots no longer matches the live Task's remaining
 * effort, or when a snapshot's Task is gone. Adding a new Task does not, by itself, mark a plan
 * stale, because that Task is absent from the plan's snapshots.
 */
public final class PlanFreshness {

	private PlanFreshness() {}

	public static boolean needsRefresh(DailyPlan plan) {
		for (DailyPlanTask planTask : plan.getLatestRevision().getTasks()) {
			Task live = planTask.getTaskReference();
			if (live == null
					|| !isPlannable(live)
					|| !capturedRemainingMatches(plan, planTask, live)) {
				return true;
			}
		}
		return false;
	}

	private static boolean isPlannable(Task task) {
		return task.getStatus() == TaskStatus.OPEN || task.getStatus() == TaskStatus.IN_PROGRESS;
	}

	private static boolean capturedRemainingMatches(
			DailyPlan plan, DailyPlanTask planTask, Task live) {
		Integer captured = planTask.getCapturedRemainingEffortMinutes();
		if (plan.getCadenceEnabled() == null && captured == null) {
			// A V5-migrated plan captured the whole-task estimate, not remaining effort.
			captured = planTask.getTaskEstimatedMinutes();
		}
		return Objects.equals(captured, live.getRemainingEffortMinutes());
	}
}
