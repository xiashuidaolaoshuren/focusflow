package com.focusflow.common.error;

public class ConflictException extends RuntimeException {

	private final String code;

	public ConflictException(String message) {
		super(message);
		this.code = null;
	}

	public ConflictException(String code, String message) {
		super(message);
		this.code = code;
	}

	public String getCode() {
		return code;
	}
}
