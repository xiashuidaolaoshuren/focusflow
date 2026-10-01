package com.focusflow.schedule;

public final class SchedulePostconditionException extends RuntimeException {

	private final SchedulePostconditionViolation violation;

	public SchedulePostconditionException(
			SchedulePostconditionViolation violation, String message) {
		super(message);
		this.violation = violation;
	}

	public SchedulePostconditionViolation violation() {
		return violation;
	}
}
