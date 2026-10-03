package com.focusflow.plan.dto;

import com.focusflow.effort.WorkOutcome;
import com.focusflow.plan.BlockDisplayState;
import com.focusflow.schedule.BlockKind;
import java.time.LocalTime;

public record ScheduledBlockResponse(
		BlockKind kind,
		LocalTime startTime,
		LocalTime endTime,
		Integer sessionIndex,
		Integer sessionCount,
		TaskSnapshotResponse taskSnapshot,
		String label,
		Long id,
		Long revisionId,
		WorkOutcome outcome,
		Integer actualMinutes,
		boolean reconciled,
		int progressVersion,
		BlockDisplayState displayState) {}
