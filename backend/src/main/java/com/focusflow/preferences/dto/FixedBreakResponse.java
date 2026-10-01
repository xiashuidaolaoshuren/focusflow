package com.focusflow.preferences.dto;

import java.time.LocalTime;

public record FixedBreakResponse(String label, LocalTime startTime, LocalTime endTime) {}
