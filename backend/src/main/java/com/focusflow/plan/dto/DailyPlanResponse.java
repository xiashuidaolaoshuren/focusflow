package com.focusflow.plan.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record DailyPlanResponse(
		Long id,
		LocalDate planDate,
		Instant createdAt,
		LocalTime windowStart,
		LocalTime windowEnd,
		LocalTime peakStart,
		LocalTime peakEnd,
		int freeMinutes,
		int scheduledWorkMinutes,
		long requiredMinutes,
		int requestedBufferMinutes,
		int realizedBufferMinutes,
		DailyPlanWarning warning,
		List<ScheduledBlockResponse> blocks,
		List<UnplacedWorkResponse> unplacedWork) {}
