package com.focusflow.plan.dto;

import java.time.Instant;
import java.time.LocalDate;

public record DailyPlanSummaryResponse(
		Long id,
		LocalDate planDate,
		Instant createdAt,
		int scheduledWorkMinutes,
		int workSessionCount,
		int scheduledTaskCount,
		int unplacedWorkCount,
		boolean hasWarning) {}
