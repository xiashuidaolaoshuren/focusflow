package com.focusflow.schedule;

import java.time.LocalTime;

public record UnavailableSegment(
		UnavailableSegmentKind kind, String label, LocalTime start, LocalTime end) {}