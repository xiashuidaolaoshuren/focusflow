package com.focusflow.plan.dto;

import com.focusflow.schedule.UnplacedReason;
import java.util.List;

public record UnplacedWorkResponse(
		UnplacedReason reason,
		Integer unplacedMinutes,
		TaskSnapshotResponse taskSnapshot,
		List<Long> blockerSourceTaskIds) {

	public UnplacedWorkResponse(
			UnplacedReason reason,
			Integer unplacedMinutes,
			TaskSnapshotResponse taskSnapshot) {
		this(reason, unplacedMinutes, taskSnapshot, List.of());
	}
}
