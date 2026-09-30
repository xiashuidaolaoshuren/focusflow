package com.focusflow.plan;

import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedWork;
import java.time.LocalTime;
import java.util.List;

public record DailyPlanSchedule(
		LocalTime windowStart,
		LocalTime windowEnd,
		LocalTime peakStart,
		LocalTime peakEnd,
		int freeMinutes,
		int scheduledWorkMinutes,
		long requiredMinutes,
		int requestedBufferMinutes,
		int realizedBufferMinutes,
		List<ScheduledBlock> blocks,
		List<UnplacedWork> unplacedWork) {}
