package com.focusflow.effort;

import java.time.Instant;
import java.time.LocalDate;

public sealed interface EffortEvent permits EffortEvent.Checkpoint, EffortEvent.WorkCredit {

	LocalDate workDate();

	Instant firstRecordedAt();

	long saveId();

	record WorkCredit(
			LocalDate workDate,
			Instant firstRecordedAt,
			long saveId,
			WorkOutcome outcome,
			int plannedMinutes,
			Integer actualMinutes)
			implements EffortEvent {}

	record Checkpoint(
			LocalDate workDate,
			Instant firstRecordedAt,
			long saveId,
			Integer assessedRemainingMinutes)
			implements EffortEvent {}
}
