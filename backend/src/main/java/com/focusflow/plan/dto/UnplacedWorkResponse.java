package com.focusflow.plan.dto;

import com.focusflow.schedule.UnplacedReason;

public record UnplacedWorkResponse(
		UnplacedReason reason, Integer unplacedMinutes, TaskSnapshotResponse taskSnapshot) {}
