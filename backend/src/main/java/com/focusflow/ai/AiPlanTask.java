package com.focusflow.ai;

import com.focusflow.dependency.RankingGroup;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.util.List;

public record AiPlanTask(
		long id,
		String title,
		String description,
		TaskPriority priority,
		LocalDate dueDate,
		Integer estimatedMinutes,
		Integer remainingEffortMinutes,
		TaskStatus status,
		RankingGroup block,
		List<Long> blockedBy) {

	public AiPlanTask(
			long id,
			String title,
			String description,
			TaskPriority priority,
			LocalDate dueDate,
			Integer estimatedMinutes,
			TaskStatus status) {
		this(id, title, description, priority, dueDate, estimatedMinutes, null, status, null, List.of());
	}

	public AiPlanTask(
			long id,
			String title,
			String description,
			TaskPriority priority,
			LocalDate dueDate,
			Integer estimatedMinutes,
			Integer remainingEffortMinutes,
			TaskStatus status) {
		this(
				id,
				title,
				description,
				priority,
				dueDate,
				estimatedMinutes,
				remainingEffortMinutes,
				status,
				null,
				List.of());
	}
}
