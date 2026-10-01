package com.focusflow.commitment;

import com.focusflow.commitment.dto.CommitmentRequest;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.time.MinutePrecision;
import java.time.LocalTime;
import java.util.List;

final class CommitmentValidator {

	private CommitmentValidator() {}

	static void validate(CommitmentRequest request) {
		if (request.title() == null || request.title().isBlank()) {
			throw new BadRequestException("title must not be blank");
		}
		if (request.title().length() > 255) {
			throw new BadRequestException("title must be at most 255 characters");
		}
		MinutePrecision.requireMinuteAligned(request.startTime());
		MinutePrecision.requireMinuteAligned(request.endTime());
		if (!request.endTime().isAfter(request.startTime())) {
			throw new BadRequestException("end time must be after start time");
		}
	}

	static void validateNoOverlap(
			CommitmentRequest request, List<Commitment> sameDateCommitments, Long excludeId) {
		for (Commitment existing : sameDateCommitments) {
			if (excludeId != null && excludeId.equals(existing.getId())) {
				continue;
			}
			if (intervalsOverlap(
					request.startTime(),
					request.endTime(),
					existing.getStartTime(),
					existing.getEndTime())) {
				throw new BadRequestException("commitments must not overlap on the same date");
			}
		}
	}

	private static boolean intervalsOverlap(
			LocalTime start, LocalTime end, LocalTime otherStart, LocalTime otherEnd) {
		return start.isBefore(otherEnd) && otherStart.isBefore(end);
	}
}
