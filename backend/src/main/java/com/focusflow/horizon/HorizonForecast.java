package com.focusflow.horizon;

import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record HorizonForecast(
		LocalDate currentDate,
		LocalTime currentTime,
		List<HorizonDay> days,
		List<HorizonTaskRow> tasks) {

	public enum DayKind {
		SAVED,
		FORECAST
	}

	public record HorizonDay(
			LocalDate date,
			DayKind kind,
			Long planId,
			boolean needsRefresh,
			List<Long> dependenciesIgnored) {}

	public record HorizonTaskRow(
			long taskId,
			String title,
			TaskStatus status,
			LocalDate dueDate,
			Integer remainingEffortMinutes,
			DeadlineStatus deadlineStatus,
			LocalDate projectedFinishDate,
			List<TaskRef> waitingOn,
			List<TaskRef> upstreamBlockers,
			List<TaskRef> unresolvedEffort,
			List<HorizonSegment> segments) {}

	public record TaskRef(long taskId, String title) {}

	public enum DeadlineStatus {
		OVERDUE,
		CANNOT_FORECAST,
		ON_TRACK,
		AT_RISK,
		BEYOND_HORIZON
	}

	public enum CreditExclusion {
		DEPENDENCY,
		CHECKPOINT
	}

	public enum UnplacedScope {
		SAVED_SHORTFALL,
		FORECAST
	}

	public record HorizonSegment(
			LocalDate date,
			int minutes,
			Integer assumedCreditMinutes,
			List<CreditExclusion> creditExclusions,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes,
			UnplacedScope unplacedScope) {}
}
