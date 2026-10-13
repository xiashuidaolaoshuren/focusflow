package com.focusflow.plan.dto;

import com.focusflow.schedule.UnplacedReason;
import java.util.List;

public record DailyPlanWarning(
		long requiredMinutes,
		int freeMinutes,
		int scheduledWorkMinutes,
		List<OutOfTimeTask> outOfTimeTasks,
		List<UnestimatedTask> unestimatedTasks,
		List<BlockedTask> blockedTasks) {

	public DailyPlanWarning(
			long requiredMinutes,
			int freeMinutes,
			int scheduledWorkMinutes,
			List<OutOfTimeTask> outOfTimeTasks,
			List<UnestimatedTask> unestimatedTasks) {
		this(
				requiredMinutes,
				freeMinutes,
				scheduledWorkMinutes,
				outOfTimeTasks,
				unestimatedTasks,
				List.of());
	}

	public record OutOfTimeTask(long sourceTaskId, String title, int unplacedMinutes) {}

	public record UnestimatedTask(long sourceTaskId, String title) {}

	public record BlockedTask(long sourceTaskId, String title, List<Long> blockerSourceTaskIds) {}
}
