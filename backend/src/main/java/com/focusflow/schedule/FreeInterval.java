package com.focusflow.schedule;

import java.time.LocalTime;

/**
 * One work-free span inside the work window, after unavailable time is subtracted and the
 * trailing buffer is reserved. A restorative flag is true when the unavailable gap adjacent
 * at that boundary contains a fixed break; commitments and window edges are not restorative.
 */
public record FreeInterval(
		LocalTime start,
		LocalTime end,
		boolean restorativeBeforeStart,
		boolean restorativeAfterEnd) {}