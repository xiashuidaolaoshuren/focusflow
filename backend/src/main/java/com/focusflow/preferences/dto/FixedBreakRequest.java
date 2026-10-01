package com.focusflow.preferences.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalTime;

public record FixedBreakRequest(
		@NotBlank @Size(max = 255) String label,
		@NotNull LocalTime startTime,
		@NotNull LocalTime endTime) {}
