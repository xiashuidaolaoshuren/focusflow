package com.focusflow.common.error;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class CodedApiErrorTest {

	@Test
	void conflictException_messageOnlyConstructor_hasNullCode() {
		ConflictException exception = new ConflictException("plan already exists");

		assertThat(exception.getCode()).isNull();
	}

	@Test
	void conflictException_codedConstructor_storesCode() {
		ConflictException exception = new ConflictException("PLAN_EXISTS", "plan already exists");

		assertThat(exception.getCode()).isEqualTo("PLAN_EXISTS");
	}

	@Test
	void badRequestException_messageOnlyConstructor_hasNullCode() {
		BadRequestException exception = new BadRequestException("invalid request");

		assertThat(exception.getCode()).isNull();
	}

	@Test
	void badRequestException_codedConstructor_storesCode() {
		BadRequestException exception =
				new BadRequestException("PLAN_CANDIDATE_LIMIT", "too many candidates");

		assertThat(exception.getCode()).isEqualTo("PLAN_CANDIDATE_LIMIT");
	}

	@Test
	void apiErrorResponse_withoutDetails_hasNullCode() {
		ApiErrorResponse response =
				ApiErrorResponse.withoutDetails(400, "Bad Request", "invalid", "/api/test", "req-1");

		assertThat(response.code()).isNull();
	}

	@Test
	void apiErrorResponse_ofWithCode_storesCode() {
		ApiErrorResponse response =
				ApiErrorResponse.of(
						409,
						"Conflict",
						"plan exists",
						"/api/test",
						null,
						"req-1",
						"PLAN_EXISTS");

		assertThat(response.code()).isEqualTo("PLAN_EXISTS");
	}
}
