package com.focusflow.preferences;

import java.time.LocalTime;
import java.util.List;

public record EffectiveSchedulingPreferences(
		LocalTime workDayStart,
		LocalTime workDayEnd,
		boolean cadenceEnabled,
		int targetFocusMinutes,
		int breakMinutes,
		int minSessionMinutes,
		int bufferMinutes,
		LocalTime peakStart,
		LocalTime peakEnd,
		List<EffectiveFixedBreak> fixedBreaks) {}
