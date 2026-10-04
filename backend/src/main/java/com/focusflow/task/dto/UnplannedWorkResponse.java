package com.focusflow.task.dto;

import java.time.Instant;
import java.time.LocalDate;

public record UnplannedWorkResponse(
		Long id,
		Long sourceTaskId,
		Long taskReferenceId,
		LocalDate workDate,
		Integer actualMinutes,
		Instant recordedAt) {}
