package com.focusflow.task.dto;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;

public record TaskResponse(
		Long id,
		String title,
		String description,
		TaskPriority priority,
		TaskStatus status,
		LocalDate dueDate,
		Integer estimatedMinutes,
		Integer remainingEffortMinutes,
		int effortVersion) {}
