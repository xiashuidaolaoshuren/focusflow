package com.focusflow.schedule;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalTime;

public record RailSegment(
		int revisionNumber,
		BlockKind kind,
		LocalTime start,
		LocalTime end,
		Long sourceTaskId,
		String label,
		WorkOutcome outcome,
		Integer actualMinutes,
		Integer sessionIndex,
		Integer sessionCount) {}
