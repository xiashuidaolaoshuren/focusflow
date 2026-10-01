package com.focusflow.common.time;

import com.focusflow.common.error.BadRequestException;
import java.time.LocalTime;

public final class MinutePrecision {

	private MinutePrecision() {}

	public static void requireMinuteAligned(LocalTime time) {
		if (time.getSecond() != 0 || time.getNano() != 0) {
			throw new BadRequestException("times must be minute-aligned");
		}
	}
}