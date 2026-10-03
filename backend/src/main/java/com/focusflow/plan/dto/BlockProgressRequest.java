package com.focusflow.plan.dto;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalDate;
import java.time.LocalTime;

public record BlockProgressRequest(
		WorkOutcome outcome,
		Integer actualMinutes,
		LocalDate currentDate,
		Integer expectedProgressVersion,
		boolean finish,
		Checkpoint checkpoint,
		LocalTime cutoff) {

	public record Checkpoint(Integer remainingEffortMinutes) {}

	/** An ordinary save that carries no re-plan cutoff. */
	public BlockProgressRequest(
			WorkOutcome outcome,
			Integer actualMinutes,
			LocalDate currentDate,
			Integer expectedProgressVersion,
			boolean finish,
			Checkpoint checkpoint) {
		this(outcome, actualMinutes, currentDate, expectedProgressVersion, finish, checkpoint, null);
	}
}
