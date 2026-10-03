package com.focusflow.plan.dto;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalDate;

public record BlockProgressRequest(
		WorkOutcome outcome,
		Integer actualMinutes,
		LocalDate currentDate,
		Integer expectedProgressVersion,
		boolean finish,
		Checkpoint checkpoint) {

	public record Checkpoint(Integer remainingEffortMinutes) {}
}
