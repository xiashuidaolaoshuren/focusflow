package com.focusflow.preferences;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.time.MinutePrecision;
import com.focusflow.preferences.dto.FixedBreakRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesRequest;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

final class SchedulingPreferencesValidator {

	private SchedulingPreferencesValidator() {}

	static void validate(SchedulingPreferencesRequest request) {
		MinutePrecision.requireMinuteAligned(request.workDayStart());
		MinutePrecision.requireMinuteAligned(request.workDayEnd());
		if (!request.workDayEnd().isAfter(request.workDayStart())) {
			throw new BadRequestException("work day end must be after work day start");
		}

		int windowLengthMinutes = windowLengthMinutes(request.workDayStart(), request.workDayEnd());
		if (request.bufferMinutes() < 0 || request.bufferMinutes() >= windowLengthMinutes) {
			throw new BadRequestException("buffer minutes must be less than work window length");
		}

		if (request.cadenceEnabled()) {
			if (request.minSessionMinutes() < 1) {
				throw new BadRequestException("min session minutes must be at least 1");
			}
			if (request.targetFocusMinutes() < request.minSessionMinutes()) {
				throw new BadRequestException("target focus minutes must be at least min session minutes");
			}
			if (request.breakMinutes() < 1) {
				throw new BadRequestException("break minutes must be at least 1");
			}
		}

		validatePeakWindow(request);
		validateFixedBreaks(request);
	}

	private static void validatePeakWindow(SchedulingPreferencesRequest request) {
		LocalTime peakStart = request.peakStart();
		LocalTime peakEnd = request.peakEnd();
		if (peakStart == null && peakEnd == null) {
			return;
		}
		if (peakStart == null || peakEnd == null) {
			throw new BadRequestException("peak window requires both start and end");
		}
		MinutePrecision.requireMinuteAligned(peakStart);
		MinutePrecision.requireMinuteAligned(peakEnd);
		if (!peakEnd.isAfter(peakStart)) {
			throw new BadRequestException("peak end must be after peak start");
		}
		if (!liesWithinWindow(peakStart, peakEnd, request.workDayStart(), request.workDayEnd())) {
			throw new BadRequestException("peak window must lie inside the work window");
		}
	}

	private static void validateFixedBreaks(SchedulingPreferencesRequest request) {
		List<FixedBreakRequest> fixedBreaks =
				request.fixedBreaks() == null ? List.of() : request.fixedBreaks();
		List<FixedBreakRequest> sortedBreaks =
				fixedBreaks.stream()
						.sorted(Comparator.comparing(FixedBreakRequest::startTime))
						.toList();

		LocalTime previousEnd = null;
		for (FixedBreakRequest fixedBreak : sortedBreaks) {
			if (fixedBreak.label() == null || fixedBreak.label().isBlank()) {
				throw new BadRequestException("fixed break label must not be blank");
			}
			if (fixedBreak.label().length() > 255) {
				throw new BadRequestException("fixed break label must be at most 255 characters");
			}
			MinutePrecision.requireMinuteAligned(fixedBreak.startTime());
			MinutePrecision.requireMinuteAligned(fixedBreak.endTime());
			if (!fixedBreak.endTime().isAfter(fixedBreak.startTime())) {
				throw new BadRequestException("fixed break end must be after fixed break start");
			}
			if (!liesWithinWindow(
					fixedBreak.startTime(),
					fixedBreak.endTime(),
					request.workDayStart(),
					request.workDayEnd())) {
				throw new BadRequestException("fixed break must lie wholly inside the work window");
			}
			if (previousEnd != null && fixedBreak.startTime().isBefore(previousEnd)) {
				throw new BadRequestException("fixed breaks must not overlap");
			}
			previousEnd = fixedBreak.endTime();
		}
	}

	private static boolean liesWithinWindow(
			LocalTime start, LocalTime end, LocalTime windowStart, LocalTime windowEnd) {
		return !start.isBefore(windowStart) && !end.isAfter(windowEnd);
	}

	private static int windowLengthMinutes(LocalTime start, LocalTime end) {
		return (int) java.time.Duration.between(start, end).toMinutes();
	}
}
