package com.focusflow.plan;

import com.focusflow.common.error.ConflictException;
import com.focusflow.plan.dto.TaskEffortVersion;
import com.focusflow.task.Task;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

final class PlanReplanFreshness {

	private PlanReplanFreshness() {}

	static void validate(
			Long expectedRevisionId,
			List<TaskEffortVersion> requestedVersions,
			DailyPlanRevision latestRevision,
			List<Task> plannableTasks) {
		if (!Objects.equals(latestRevision.getId(), expectedRevisionId)) {
			throw new ConflictException("PLAN_CHANGED", "plan revision has changed");
		}
		if (!effortVersionsMatch(requestedVersions, plannableTasks)) {
			throw new ConflictException("PLAN_CHANGED", "candidate effort versions have changed");
		}
	}

	private static boolean effortVersionsMatch(
			List<TaskEffortVersion> requestedVersions, List<Task> plannableTasks) {
		Map<Long, Integer> requested = toMap(requestedVersions);
		Map<Long, Integer> current = new HashMap<>();
		for (Task task : plannableTasks) {
			long taskId = task.getId() != null ? task.getId() : 0L;
			current.put(taskId, task.getEffortVersion());
		}
		return requested.equals(current);
	}

	private static Map<Long, Integer> toMap(List<TaskEffortVersion> versions) {
		Map<Long, Integer> map = new HashMap<>();
		for (TaskEffortVersion version : versions) {
			map.put(version.taskId(), version.effortVersion());
		}
		return map;
	}
}
