package com.focusflow.ai;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;

public record AiPlanTask(
		long id,
		String title,
		String description,
		TaskPriority priority,
		LocalDate dueDate,
		Integer estimatedMinutes,
		Integer remainingEffortMinutes,
		TaskStatus status) {

	public AiPlanTask(
			long id,
			String title,
			String description,
			TaskPriority priority,
			LocalDate dueDate,
			Integer estimatedMinutes,
			TaskStatus status) {
		this(id, title, description, priority, dueDate, estimatedMinutes, null, status);
	}
}
