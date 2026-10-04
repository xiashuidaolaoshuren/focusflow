package com.focusflow.plan.dto;

import java.time.LocalTime;
import java.util.List;

public record PlanRevisionResponse(
		Long id,
		int revisionNumber,
		LocalTime cutoff,
		int freeMinutes,
		int scheduledWorkMinutes,
		long requiredMinutes,
		int requestedBufferMinutes,
		int realizedBufferMinutes,
		List<ScheduledBlockResponse> blocks,
		List<UnplacedWorkResponse> unplacedWork) {}
