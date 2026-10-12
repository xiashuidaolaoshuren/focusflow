package com.focusflow.task;

import com.focusflow.task.dto.TaskResponse;
import org.springframework.stereotype.Component;

@Component
public class TaskResponseMapper {

	public TaskResponse toResponse(Task task) {
		return new TaskResponse(
				task.getId(),
				task.getTitle(),
				task.getDescription(),
				task.getPriority(),
				task.getStatus(),
				task.getDueDate(),
				task.getEstimatedMinutes(),
				task.getRemainingEffortMinutes(),
				task.getEffortVersion());
	}
}
