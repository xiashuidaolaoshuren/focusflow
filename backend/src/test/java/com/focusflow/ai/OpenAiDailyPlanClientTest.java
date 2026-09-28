package com.focusflow.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

class OpenAiDailyPlanClientTest {

	private static final String BASE_URL = "https://api.deepseek.com/v1";

	private MockRestServiceServer mockServer;
	private OpenAiDailyPlanClient client;
	private DailyPlanPromptBuilder promptBuilder;
	private SimpleMeterRegistry meterRegistry;

	@BeforeEach
	void setUp() {
		promptBuilder = new DailyPlanPromptBuilder();
		meterRegistry = new SimpleMeterRegistry();
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key", "deepseek-chat", BASE_URL, null, null, 0, null, null));
	}

	private OpenAiDailyPlanClient createClient(OpenAiProperties properties) {
		return createClient(properties, duration -> {});
	}

	private OpenAiDailyPlanClient createClient(OpenAiProperties properties, Sleeper sleeper) {
		RestClient.Builder builder = RestClient.builder();
		mockServer = MockRestServiceServer.bindTo(builder).build();
		RestClient restClient = builder.baseUrl(BASE_URL).build();
		return new OpenAiDailyPlanClient(
				restClient, promptBuilder, properties, new ObjectMapper(), sleeper, meterRegistry);
	}

	@Test
	void generate_retriesOnConnectFailure_thenSucceeds() {
		OpenAiProperties retryProperties =
				new OpenAiProperties(
						"test-api-key",
						"deepseek-chat",
						BASE_URL,
						null,
						null,
						2,
						Duration.ZERO,
						Duration.ZERO);
		client = createClient(retryProperties);

		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						httpRequest ->
								{
									throw new ResourceAccessException(
											"Connection refused", new ConnectException("Connection refused"));
								});
		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withSuccess(
								"""
								{
								  "choices": [
								    {
								      "message": {
								        "content": "{\\"taskIds\\":[]}"
								      }
								    }
								  ]
								}
								""",
								MediaType.APPLICATION_JSON));

		AiDailyPlanResponse response = client.generate(request);

		assertThat(response.taskIds()).isEmpty();
		mockServer.verify();
	}

	@Test
	void generate_retriesOn429WithRetryAfter_thenSucceeds() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		AiDailyPlanRequest request = minimalRequest();

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withStatus(HttpStatus.TOO_MANY_REQUESTS)
								.header("Retry-After", "1")
								.body("rate limited")
								.contentType(MediaType.APPLICATION_JSON));
		expectEmptySuccessResponse();

		AiDailyPlanResponse response = client.generate(request);

		assertThat(response.taskIds()).isEmpty();
		mockServer.verify();
	}

	@Test
	void generate_retriesOn429_capsRetryAfterAtMaxRetryAfter() {
		List<Duration> sleptDurations = new ArrayList<>();
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ofSeconds(5)),
						sleptDurations::add);

		AiDailyPlanRequest request = minimalRequest();

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withStatus(HttpStatus.TOO_MANY_REQUESTS)
								.header("Retry-After", "9999")
								.body("rate limited")
								.contentType(MediaType.APPLICATION_JSON));
		expectEmptySuccessResponse();

		client.generate(request);

		assertThat(sleptDurations).containsExactly(Duration.ofSeconds(5));
		mockServer.verify();
	}

	private AiDailyPlanRequest minimalRequest() {
		return new AiDailyPlanRequest(
				List.of(
						new AiPlanTask(
								1L,
								"Write tests",
								null,
								TaskPriority.HIGH,
								null,
								null,
								TaskStatus.OPEN)),
				LocalDate.of(2026, 6, 1));
	}

	private void expectEmptySuccessResponse() {
		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withSuccess(
								"""
								{
								  "choices": [
								    {
								      "message": {
								        "content": "{\\"taskIds\\":[]}"
								      }
								    }
								  ]
								}
								""",
								MediaType.APPLICATION_JSON));
	}

	@Test
	void generate_retriesOn502_thenSucceeds() {
		assertRetriesOnTransientServerErrorThenSucceeds(HttpStatus.BAD_GATEWAY);
	}

	@Test
	void generate_retriesOn503_thenSucceeds() {
		assertRetriesOnTransientServerErrorThenSucceeds(HttpStatus.SERVICE_UNAVAILABLE);
	}

	@Test
	void generate_retriesOn504_thenSucceeds() {
		assertRetriesOnTransientServerErrorThenSucceeds(HttpStatus.GATEWAY_TIMEOUT);
	}

	private void assertRetriesOnTransientServerErrorThenSucceeds(HttpStatus status) {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		AiDailyPlanRequest request = minimalRequest();

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(withStatus(status).body("transient").contentType(MediaType.APPLICATION_JSON));
		expectEmptySuccessResponse();

		AiDailyPlanResponse response = client.generate(request);

		assertThat(response.taskIds()).isEmpty();
		mockServer.verify();
	}

	@Test
	void generate_recordsSuccessTimer() {
		expectEmptySuccessResponse();

		client.generate(minimalRequest());

		Timer timer =
				meterRegistry
						.find("focusflow.ai.generate")
						.tag("outcome", "success")
						.timer();
		assertThat(timer).isNotNull();
		assertThat(timer.count()).isEqualTo(1);
	}

	@Test
	void generate_recordsRetryCounterOn429() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withStatus(HttpStatus.TOO_MANY_REQUESTS)
								.header("Retry-After", "1")
								.body("rate limited")
								.contentType(MediaType.APPLICATION_JSON));
		expectEmptySuccessResponse();

		client.generate(minimalRequest());

		assertThat(
						meterRegistry
								.find("focusflow.ai.retries")
								.tag("reason", "429")
								.counter()
								.count())
				.isEqualTo(1.0);
	}

	@Test
	void generate_recordsExhaustedFailureCounter() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						httpRequest ->
								{
									throw new ResourceAccessException(
											"Connection refused", new ConnectException("Connection refused"));
								});
		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						httpRequest ->
								{
									throw new ResourceAccessException(
											"Connection refused", new ConnectException("Connection refused"));
								});

		assertThatThrownBy(() -> client.generate(minimalRequest()))
				.isInstanceOf(AiProviderException.class);

		assertThat(
						meterRegistry
								.find("focusflow.ai.failures")
								.tag("outcome", "exhausted")
								.counter()
								.count())
				.isEqualTo(1.0);
	}

	@Test
	void generate_doesNotRetryOnReadTimeout() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		AiDailyPlanRequest request = minimalRequest();

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						httpRequest ->
								{
									throw new ResourceAccessException(
											"Read timed out", new SocketTimeoutException("Read timed out"));
								});

		assertThatThrownBy(() -> client.generate(request))
				.isInstanceOf(AiProviderException.class)
				.hasMessageContaining("AI provider request failed");

		mockServer.verify();
	}

	@Test
	void generate_doesNotRetryOn500() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(withServerError());

		assertThatThrownBy(() -> client.generate(minimalRequest()))
				.isInstanceOf(AiProviderException.class);

		mockServer.verify();
	}

	@Test
	void generate_doesNotRetryOn401() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withStatus(HttpStatus.UNAUTHORIZED)
								.body("unauthorized")
								.contentType(MediaType.APPLICATION_JSON));

		assertThatThrownBy(() -> client.generate(minimalRequest()))
				.isInstanceOf(AiProviderException.class);

		mockServer.verify();
	}

	@Test
	void generate_doesNotRetryOnMalformedResponseBody() {
		client =
				createClient(
						new OpenAiProperties(
								"test-api-key",
								"deepseek-chat",
								BASE_URL,
								null,
								null,
								2,
								Duration.ZERO,
								Duration.ZERO));

		expectChatCompletionResponse("not-json");

		assertThatThrownBy(() -> client.generate(minimalRequest()))
				.isInstanceOf(AiProviderException.class);

		mockServer.verify();
	}

	@Test
	void generate_usesConfiguredBaseUrlModelAndPromptBuilderOutput() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										"TDD coverage",
										TaskPriority.HIGH,
										LocalDate.of(2026, 6, 1),
										45,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));
		String expectedPrompt = promptBuilder.build(request) + OpenAiDailyPlanClient.STRUCTURED_OUTPUT_SUFFIX;

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andExpect(header("Authorization", "Bearer test-api-key"))
				.andExpect(content().contentType(MediaType.APPLICATION_JSON))
				.andExpect(
						content()
								.json(
										"""
										{
										  "model": "deepseek-chat",
										  "messages": [
										    {
										      "role": "user",
										      "content": "%s"
										    }
										  ]
										}
										"""
												.formatted(escapeJson(expectedPrompt))))
				.andRespond(
						withSuccess(
								"""
								{
								  "choices": [
								    {
								      "message": {
								        "content": "{\\"taskIds\\":[]}"
								      }
								    }
								  ]
								}
								""",
								MediaType.APPLICATION_JSON));

		AiDailyPlanResponse response = client.generate(request);

		assertThat(response.taskIds()).isEmpty();
		mockServer.verify();
	}

	@Test
	void generate_mapsValidStructuredProviderResponseIntoOrderedPlanItems() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										10L,
										"First task",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN),
								new AiPlanTask(
										20L,
										"Second task",
										null,
										TaskPriority.LOW,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withSuccess(
								"""
								{
								  "choices": [
								    {
								      "message": {
								        "content": "{\\"taskIds\\":[20,10]}"
								      }
								    }
								  ]
								}
								""",
								MediaType.APPLICATION_JSON));

		AiDailyPlanResponse response = client.generate(request);

		assertThat(response.taskIds()).containsExactly(20L, 10L);
		mockServer.verify();
	}

	@Test
	void generate_whenProviderReturnsHttpError_throwsAiProviderExceptionWithSafeMessage() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(withServerError());

		assertThatThrownBy(() -> client.generate(request))
				.isInstanceOf(AiProviderException.class)
				.hasMessageContaining("AI provider request failed")
				.hasMessageNotContaining("test-api-key");

		mockServer.verify();
	}

	@Test
	void generate_whenStructuredOutputMissingTaskIds_throwsAiProviderException() {
		expectChatCompletionResponse("{\"summary\":\"no taskIds here\"}");

		assertMalformedOutputFailure();
	}

	@Test
	void generate_whenStructuredOutputHasNonPositiveTaskId_throwsAiProviderException() {
		expectChatCompletionResponse("{\"taskIds\":[0]}");

		assertMalformedOutputFailure();
	}

	@Test
	void generate_whenStructuredOutputIsInvalidJson_throwsAiProviderException() {
		expectChatCompletionResponse("not-json");

		assertMalformedOutputFailure();
	}

	private void expectChatCompletionResponse(String structuredContent) {
		String escapedContent =
				structuredContent.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
		mockServer
				.expect(requestTo(BASE_URL + "/chat/completions"))
				.andExpect(method(HttpMethod.POST))
				.andRespond(
						withSuccess(
								"""
								{
								  "choices": [
								    {
								      "message": {
								        "content": "%s"
								      }
								    }
								  ]
								}
								"""
										.formatted(escapedContent),
								MediaType.APPLICATION_JSON));
	}

	private void assertMalformedOutputFailure() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		assertThatThrownBy(() -> client.generate(request))
				.isInstanceOf(AiProviderException.class);

		mockServer.verify();
	}

	private static String escapeJson(String value) {
		return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
	}
}
