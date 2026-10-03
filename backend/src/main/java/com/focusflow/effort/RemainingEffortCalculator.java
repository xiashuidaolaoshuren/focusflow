package com.focusflow.effort;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class RemainingEffortCalculator {

	private RemainingEffortCalculator() {}

	public static EffortAssessment apply(Integer startingRemaining, List<EffortEvent> events) {
		List<EffortEvent> ordered = new ArrayList<>(events);
		ordered.sort(
				Comparator.comparing(EffortEvent::workDate)
						.thenComparing(EffortEvent::firstRecordedAt));

		int remaining = startingRemaining;
		for (EffortEvent event : ordered) {
			if (event instanceof EffortEvent.Checkpoint checkpoint) {
				remaining = checkpoint.assessedRemainingMinutes();
			} else if (event instanceof EffortEvent.WorkCredit work) {
				if (work.outcome() == WorkOutcome.DONE) {
					remaining -= work.plannedMinutes();
				} else if (work.outcome() == WorkOutcome.PARTLY_DONE) {
					remaining -= work.actualMinutes();
				} else if (work.outcome() == WorkOutcome.SKIPPED) {
					// Skipped work credits nothing.
				}
			}
		}
		return new AcceptedEffort(remaining);
	}
}
