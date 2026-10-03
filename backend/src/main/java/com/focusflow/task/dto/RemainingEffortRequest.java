package com.focusflow.task.dto;

import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record RemainingEffortRequest(
		@Positive Integer remainingEffortMinutes,
		LocalDate currentDate,
		Integer effortVersion) {}
