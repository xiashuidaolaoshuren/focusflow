package com.focusflow.common.error;

import com.focusflow.ai.AiProviderException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	private static final String GENERIC_CLIENT_MESSAGE = "Unexpected error";
	private static final String MDC_REQUEST_ID_KEY = "requestId";

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ResponseEntity<ApiErrorResponse> handleValidation(
			MethodArgumentNotValidException ex, HttpServletRequest request) {
		Map<String, List<String>> details = new LinkedHashMap<>();
		for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
			details.computeIfAbsent(fieldError.getField(), key -> new ArrayList<>())
					.add(fieldError.getDefaultMessage());
		}

		ApiErrorResponse body =
				ApiErrorResponse.of(
						HttpStatus.BAD_REQUEST.value(),
						HttpStatus.BAD_REQUEST.getReasonPhrase(),
						"Validation failed",
						request.getRequestURI(),
						details,
						currentRequestId());

		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
	}

	@ExceptionHandler(BadRequestException.class)
	public ResponseEntity<ApiErrorResponse> handleBadRequest(
			BadRequestException ex, HttpServletRequest request) {
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.BAD_REQUEST.value(),
						HttpStatus.BAD_REQUEST.getReasonPhrase(),
						ex.getMessage(),
						request.getRequestURI(),
						currentRequestId(),
						ex.getCode());
		return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
	}

	@ExceptionHandler(NotFoundException.class)
	public ResponseEntity<ApiErrorResponse> handleNotFound(NotFoundException ex, HttpServletRequest request) {
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.NOT_FOUND.value(),
						HttpStatus.NOT_FOUND.getReasonPhrase(),
						ex.getMessage(),
						request.getRequestURI(),
						currentRequestId());
		return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
	}

	@ExceptionHandler(ConflictException.class)
	public ResponseEntity<ApiErrorResponse> handleConflict(ConflictException ex, HttpServletRequest request) {
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.CONFLICT.value(),
						HttpStatus.CONFLICT.getReasonPhrase(),
						ex.getMessage(),
						request.getRequestURI(),
						currentRequestId(),
						ex.getCode());
		return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
	}

	@ExceptionHandler(ForbiddenOperationException.class)
	public ResponseEntity<ApiErrorResponse> handleForbidden(
			ForbiddenOperationException ex, HttpServletRequest request) {
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.FORBIDDEN.value(),
						HttpStatus.FORBIDDEN.getReasonPhrase(),
						ex.getMessage(),
						request.getRequestURI(),
						currentRequestId());
		return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
	}

	@ExceptionHandler(BadCredentialsException.class)
	public ResponseEntity<ApiErrorResponse> handleBadCredentials(
			BadCredentialsException ex, HttpServletRequest request) {
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.UNAUTHORIZED.value(),
						HttpStatus.UNAUTHORIZED.getReasonPhrase(),
						"Invalid credentials",
						request.getRequestURI(),
						currentRequestId());
		return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(body);
	}

	@ExceptionHandler(AiProviderException.class)
	public ResponseEntity<ApiErrorResponse> handleAiProvider(
			AiProviderException ex, HttpServletRequest request) {
		log.warn("AI provider failure: {}", ex.getMessage());
		String safeMessage =
				ex.getMessage() != null && !ex.getMessage().isBlank()
						? ex.getMessage()
						: "AI provider request failed";

		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.BAD_GATEWAY.value(),
						HttpStatus.BAD_GATEWAY.getReasonPhrase(),
						safeMessage,
						request.getRequestURI(),
						currentRequestId());

		return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(body);
	}

	@ExceptionHandler(Exception.class)
	public ResponseEntity<ApiErrorResponse> handleGeneric(Exception ex, HttpServletRequest request) {
		log.error("Unhandled exception", ex);
		ApiErrorResponse body =
				ApiErrorResponse.withoutDetails(
						HttpStatus.INTERNAL_SERVER_ERROR.value(),
						HttpStatus.INTERNAL_SERVER_ERROR.getReasonPhrase(),
						GENERIC_CLIENT_MESSAGE,
						request.getRequestURI(),
						currentRequestId());
		return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
	}

	private static String currentRequestId() {
		return MDC.get(MDC_REQUEST_ID_KEY);
	}
}
