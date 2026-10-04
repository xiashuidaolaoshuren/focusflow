package com.focusflow.schedule;

import java.time.LocalTime;

public final class ReplanWindow {

	private ReplanWindow() {}

	public static CutoffDecision decide(
			LocalTime windowStart, LocalTime windowEnd, LocalTime cutoff) {
		if (cutoff.isBefore(windowStart)) {
			return new CutoffDecision.Accepted(windowStart);
		}
		if (!cutoff.isBefore(windowEnd)) {
			return new CutoffDecision.Rejected();
		}
		return new CutoffDecision.Accepted(cutoff);
	}
}
