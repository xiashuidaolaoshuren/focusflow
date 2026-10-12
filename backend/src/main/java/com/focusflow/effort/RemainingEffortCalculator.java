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

		Integer remaining = startingRemaining;
		for (EffortEvent event : ordered) {
			if (event instanceof EffortEvent.Checkpoint checkpoint) {
				remaining = checkpoint.assessedRemainingMinutes();
			} else if (event instanceof EffortEvent.WorkCredit work) {
				if (remaining == null) {
					continue;
				}
				remaining -= creditFor(work.outcome(), work.plannedMinutes(), work.actualMinutes());
			}
		}
		return new AcceptedEffort(remaining);
	}

	/**
	 * The provisional credit an outcome grants: a done session credits its planned duration, a
	 * partly done session credits its actual minutes, and a skipped session credits nothing.
	 */
	public static int creditFor(WorkOutcome outcome, int plannedMinutes, Integer actualMinutes) {
		if (outcome == WorkOutcome.DONE) {
			return plannedMinutes;
		}
		if (outcome == WorkOutcome.PARTLY_DONE) {
			return actualMinutes != null ? actualMinutes : 0;
		}
		return 0;
	}
}
