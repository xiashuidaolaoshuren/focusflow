package com.focusflow.schedule;

import java.util.List;

public record FreeIntervalPlan(
		List<FreeInterval> freeIntervals,
		List<UnavailableSegment> unavailableSegments,
		int freeMinutes,
		int requestedBufferMinutes,
		int realizedBufferMinutes) {}