package com.focusflow.plan;

import com.focusflow.schedule.BlockKind;
import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import java.time.LocalTime;

/**
 * How a scheduled block is presented. Only an actionable block accepts a new recorded outcome.
 */
public enum BlockDisplayState {
	/** Sits on the actionable revision and is open to, or already carries, a recorded outcome. */
	ACTIONABLE,
	/** Sits on an earlier revision whose planned interval elapsed before the latest cutoff. */
	HISTORICAL,
	/** Sits on an earlier revision at or after the latest cutoff, so it is read-only. */
	SUPERSEDED,
	/** An unused session of a finished or cancelled Task. */
	NO_LONGER_NEEDED;

	public static BlockDisplayState of(DailyPlan plan, DailyPlanBlock block) {
		if (isSuperseded(plan, block)) {
			return SUPERSEDED;
		}
		if (isNoLongerNeeded(block)) {
			return NO_LONGER_NEEDED;
		}
		if (block.getRevision() != plan.getLatestRevision()) {
			return HISTORICAL;
		}
		return ACTIONABLE;
	}

	/**
	 * A block still sits on an older revision, that revision is no longer the latest, and the block
	 * begins at or after the latest revision's cutoff. Absence of a cutoff means the window start.
	 * Such a block is read-only.
	 */
	static boolean isSuperseded(DailyPlan plan, DailyPlanBlock block) {
		DailyPlanRevision latest = plan.getLatestRevision();
		if (latest == block.getRevision()) {
			return false;
		}
		LocalTime cutoff =
				latest.getCutoffTime() != null ? latest.getCutoffTime() : plan.getWindowStart();
		return !block.getStartTime().isBefore(cutoff);
	}

	private static boolean isNoLongerNeeded(DailyPlanBlock block) {
		if (block.getKind() != BlockKind.WORK || block.getOutcome() != null) {
			return false;
		}
		DailyPlanTask planTask = block.getDailyPlanTask();
		Task task = planTask != null ? planTask.getTaskReference() : null;
		return task != null
				&& (task.getStatus() == TaskStatus.DONE
						|| task.getStatus() == TaskStatus.CANCELLED);
	}
}
