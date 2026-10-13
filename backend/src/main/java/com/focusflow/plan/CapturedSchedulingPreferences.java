package com.focusflow.plan;

import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import java.time.LocalTime;
import java.util.List;
import java.util.Set;

final class CapturedSchedulingPreferences {

	private CapturedSchedulingPreferences() {}

	static EffectiveSchedulingPreferences fromPlan(DailyPlan plan, LocalTime effectiveCutoff) {
		List<EffectiveFixedBreak> fixedBreaks =
				plan.getFixedBreakSnapshots().stream()
						.map(
								snapshot ->
										new EffectiveFixedBreak(
												snapshot.getLabel(),
												snapshot.getStartTime(),
												snapshot.getEndTime()))
						.toList();
		return new EffectiveSchedulingPreferences(
				effectiveCutoff,
				plan.getWindowEnd(),
				plan.getCadenceEnabled(),
				plan.getTargetFocusMinutes(),
				plan.getBreakMinutes(),
				plan.getMinSessionMinutes(),
				plan.getBufferMinutes(),
				plan.getPeakStart(),
				plan.getPeakEnd(),
				fixedBreaks,
				// Horizon-only: saved plans do not capture weekday flags; composition ignores them.
				Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS));
	}
}
