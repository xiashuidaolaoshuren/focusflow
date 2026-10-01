package com.focusflow.task.dto;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record UpdateTaskRequest(
		@NotBlank String title,
		String description,
		TaskPriority priority,
		TaskStatus status,
		LocalDate dueDate,
		@Positive Integer estimatedMinutes) {}
