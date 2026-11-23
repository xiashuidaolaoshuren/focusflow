package com.focusflow.task.dto;

import com.focusflow.task.TaskPriority;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CreateTaskRequest(
		@NotBlank @Size(max = 255) String title,
		String description,
		TaskPriority priority,
		LocalDate dueDate,
		@Positive Integer estimatedMinutes) {}
