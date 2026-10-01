package com.focusflow.schedule;

public record PlacementPolicy(
		boolean cadenceEnabled,
		int targetFocusMinutes,
		int breakMinutes,
		int minSessionMinutes) {}
