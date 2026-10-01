package com.focusflow.schedule;

import java.time.LocalTime;

public record ScheduledBlock(
		BlockKind kind,
		LocalTime start,
		LocalTime end,
		Long sourceTaskId,
		String label) {}