package com.focusflow.task.dto;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.util.List;

public record TaskResponse(
		Long id,
		String title,
		String description,
		TaskPriority priority,
		TaskStatus status,
		LocalDate dueDate,
		Integer estimatedMinutes,
		Integer remainingEffortMinutes,
		int effortVersion,
		List<TaskLinkResponse> blockedBy,
		List<TaskLinkResponse> blocks) {

	public TaskResponse {
		blockedBy = blockedBy != null ? List.copyOf(blockedBy) : List.of();
		blocks = blocks != null ? List.copyOf(blocks) : List.of();
	}
}
