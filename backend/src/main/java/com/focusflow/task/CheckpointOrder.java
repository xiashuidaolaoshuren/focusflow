package com.focusflow.task;

import java.time.Instant;
import java.time.LocalDate;

/**
 * The ordering key of a Task's latest remaining-effort checkpoint. Progress is ordered by work date
 * first and by recording time second, so progress that does not sort strictly after this checkpoint
 * stays history and does not move the assessed remainder.
 */
public record CheckpointOrder(LocalDate workDate, Instant recordedAt) {

	/**
	 * Whether this checkpoint still governs work at the given ordering key. Progress counts only
	 * when it sorts strictly after the checkpoint: a later work date, or the same work date recorded
	 * after it. Anything earlier stays history.
	 */
	public boolean shields(LocalDate eventWorkDate, Instant eventRecordedAt) {
		if (eventWorkDate == null || eventRecordedAt == null) {
			return false;
		}
		int byWorkDate = workDate.compareTo(eventWorkDate);
		if (byWorkDate != 0) {
			return byWorkDate > 0;
		}
		return !recordedAt.isBefore(eventRecordedAt);
	}
}
