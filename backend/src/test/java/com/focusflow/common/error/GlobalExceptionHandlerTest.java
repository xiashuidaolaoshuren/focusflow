package com.focusflow.common.error;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = GlobalExceptionHandlerTestController.class)
@Import(GlobalExceptionHandler.class)
@WithMockUser
class GlobalExceptionHandlerTest {

	@Autowired
	private MockMvc mockMvc;

	@AfterEach
	void clearMdc() {
		MDC.clear();
	}

	@Test
	void notFound_includesRequestIdFromMdc() throws Exception {
		MDC.put("requestId", "req-1");

		mockMvc.perform(get("/__test/errors/not-found"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.requestId").value("req-1"));
	}

	@Test
	void aiProvider_includesRequestIdFromMdc() throws Exception {
		MDC.put("requestId", "req-1");

		mockMvc.perform(get("/__test/errors/ai-provider"))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.requestId").value("req-1"));
	}

	@Test
	void genericException_includesRequestIdFromMdc() throws Exception {
		MDC.put("requestId", "req-1");

		mockMvc.perform(get("/__test/errors/generic"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.requestId").value("req-1"));
	}

	@Test
	void notFound_returns404_withStandardBody() throws Exception {
		mockMvc.perform(get("/__test/errors/not-found"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.error").value("Not Found"))
				.andExpect(jsonPath("$.message").value("missing"))
				.andExpect(jsonPath("$.path").value("/__test/errors/not-found"))
				.andExpect(jsonPath("$.details").doesNotExist());
	}

	@Test
	void forbidden_returns403_withStandardBody() throws Exception {
		mockMvc.perform(get("/__test/errors/forbidden"))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.status").value(403))
				.andExpect(jsonPath("$.error").value("Forbidden"))
				.andExpect(jsonPath("$.message").value("nope"))
				.andExpect(jsonPath("$.path").value("/__test/errors/forbidden"))
				.andExpect(jsonPath("$.details").doesNotExist());
	}

	@Test
	void aiProvider_returns502_withStandardBody() throws Exception {
		mockMvc.perform(get("/__test/errors/ai-provider"))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.status").value(502))
				.andExpect(jsonPath("$.error").value("Bad Gateway"))
				.andExpect(jsonPath("$.message").value("provider failed"))
				.andExpect(jsonPath("$.path").value("/__test/errors/ai-provider"))
				.andExpect(jsonPath("$.details").doesNotExist());
	}

	@Test
	void validation_returns400_withDetails() throws Exception {
		mockMvc.perform(post("/__test/errors/validation")
						.with(csrf())
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.error").value("Bad Request"))
				.andExpect(jsonPath("$.path").value("/__test/errors/validation"))
				.andExpect(jsonPath("$.details.name").isArray())
				.andExpect(jsonPath("$.details.name[0]", containsString("must not be blank")));
	}

	@Test
	void genericException_returns500_withStandardBody() throws Exception {
		mockMvc.perform(get("/__test/errors/generic"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.status").value(500))
				.andExpect(jsonPath("$.error").value("Internal Server Error"))
				.andExpect(jsonPath("$.message").value("Unexpected error"))
				.andExpect(jsonPath("$.path").value("/__test/errors/generic"))
				.andExpect(jsonPath("$.details").doesNotExist());
	}

	@Test
	void conflict_coded_includesCode() throws Exception {
		mockMvc.perform(get("/__test/errors/conflict").param("coded", "true"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PLAN_EXISTS"))
				.andExpect(jsonPath("$.message").value("plan already exists"));
	}

	@Test
	void badRequest_coded_includesCode() throws Exception {
		mockMvc.perform(get("/__test/errors/bad-request").param("coded", "true"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PLAN_CANDIDATE_LIMIT"))
				.andExpect(jsonPath("$.message").value("too many candidates"));
	}

	@Test
	void conflict_messageOnly_omitsCode() throws Exception {
		mockMvc.perform(get("/__test/errors/conflict"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").doesNotExist())
				.andExpect(jsonPath("$.message").value("plan already exists"));
	}

	@Test
	void badRequest_messageOnly_omitsCode() throws Exception {
		mockMvc.perform(get("/__test/errors/bad-request"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").doesNotExist())
				.andExpect(jsonPath("$.message").value("invalid request"));
	}
}
