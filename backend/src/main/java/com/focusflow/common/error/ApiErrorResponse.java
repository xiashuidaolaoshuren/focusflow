package com.focusflow.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
		Instant timestamp,
		int status,
		String error,
		String message,
		String code,
		String path,
		Map<String, List<String>> details,
		String requestId) {

	public static ApiErrorResponse of(
			int status,
			String error,
			String message,
			String path,
			Map<String, List<String>> details,
			String requestId) {
		return of(status, error, message, path, details, requestId, null);
	}

	public static ApiErrorResponse of(
			int status,
			String error,
			String message,
			String path,
			Map<String, List<String>> details,
			String requestId,
			String code) {
		return new ApiErrorResponse(
				Instant.now(), status, error, message, code, path, details, requestId);
	}

	public static ApiErrorResponse withoutDetails(
			int status, String error, String message, String path, String requestId) {
		return of(status, error, message, path, null, requestId);
	}

	public static ApiErrorResponse withoutDetails(
			int status, String error, String message, String path, String requestId, String code) {
		return of(status, error, message, path, null, requestId, code);
	}
}
