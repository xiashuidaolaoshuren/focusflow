package com.focusflow.preferences.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalTime;
import java.util.List;

public record SchedulingPreferencesRequest(
		@NotNull LocalTime workDayStart,
		@NotNull LocalTime workDayEnd,
		@NotNull Boolean cadenceEnabled,
		@NotNull @Min(0) Integer targetFocusMinutes,
		@NotNull @Min(0) Integer breakMinutes,
		@NotNull @Min(1) Integer minSessionMinutes,
		@NotNull @Min(0) Integer bufferMinutes,
		LocalTime peakStart,
		LocalTime peakEnd,
		@Valid List<FixedBreakRequest> fixedBreaks) {}
