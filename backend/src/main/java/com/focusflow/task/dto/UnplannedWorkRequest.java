package com.focusflow.task.dto;

import java.time.LocalDate;

public record UnplannedWorkRequest(
		Long taskId,
		LocalDate workDate,
		Integer actualMinutes,
		LocalDate currentDate,
		Integer effortVersion,
		boolean finish,
		Checkpoint checkpoint) {

	public record Checkpoint(Integer remainingEffortMinutes) {}
}
