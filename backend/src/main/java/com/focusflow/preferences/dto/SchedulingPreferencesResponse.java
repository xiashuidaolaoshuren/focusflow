package com.focusflow.preferences.dto;

import java.time.LocalTime;
import java.util.List;

public record SchedulingPreferencesResponse(
		LocalTime workDayStart,
		LocalTime workDayEnd,
		boolean cadenceEnabled,
		int targetFocusMinutes,
		int breakMinutes,
		int minSessionMinutes,
		int bufferMinutes,
		LocalTime peakStart,
		LocalTime peakEnd,
		List<FixedBreakResponse> fixedBreaks,
		boolean persisted) {}
