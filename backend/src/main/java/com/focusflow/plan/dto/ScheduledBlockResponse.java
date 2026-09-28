package com.focusflow.plan.dto;

import com.focusflow.schedule.BlockKind;
import java.time.LocalTime;

public record ScheduledBlockResponse(
		BlockKind kind,
		LocalTime startTime,
		LocalTime endTime,
		Integer sessionIndex,
		Integer sessionCount,
		TaskSnapshotResponse taskSnapshot,
		String label) {}
