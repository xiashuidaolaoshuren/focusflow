package com.focusflow.task.dto;

import com.focusflow.task.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record CreateTaskRequest(
		@NotBlank String title,
		String description,
		TaskPriority priority,
		LocalDate dueDate,
		@Positive Integer estimatedMinutes) {}
