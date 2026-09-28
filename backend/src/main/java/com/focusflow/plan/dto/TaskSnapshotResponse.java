package com.focusflow.plan.dto;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;

public record TaskSnapshotResponse(
		long sourceTaskId,
		Long taskReferenceId,
		String title,
		TaskPriority priority,
		TaskStatus status,
		LocalDate dueDate,
		Integer estimatedMinutes,
		boolean mustInclude) {}
