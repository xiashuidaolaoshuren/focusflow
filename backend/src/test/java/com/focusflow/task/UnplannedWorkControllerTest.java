package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import com.focusflow.task.dto.UnplannedWorkRequest;
import com.focusflow.task.dto.UnplannedWorkResponse;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = UnplannedWorkController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class UnplannedWorkControllerTest {

	private static final String MINIMAL_REQUEST =
			"""
			{
			  "taskId": 7,
			  "workDate": "2026-10-05",
			  "actualMinutes": 35,
			  "currentDate": "2026-10-05",
			  "effortVersion": 0,
			  "finish": false
			}
			""";

	@Autowired
	private MockMvc mockMvc;

	@MockBean
	private UnplannedWorkService unplannedWorkService;

	@MockBean
	private FocusFlowUserDetailsService userDetailsService;

	@Test
	void create_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						post("/api/unplanned-work")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(MINIMAL_REQUEST))
				.andExpect(status().isUnauthorized());

		verify(unplannedWorkService, never()).create(any(UnplannedWorkRequest.class));
	}

	@Test
	void correct_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						put("/api/unplanned-work/9")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(MINIMAL_REQUEST))
				.andExpect(status().isUnauthorized());

		verify(unplannedWorkService, never())
				.correct(any(Long.class), any(UnplannedWorkRequest.class));
	}

	@Test
	@WithMockUser
	void create_whenAuthenticated_returns201AndBindsTheRequest() throws Exception {
		when(unplannedWorkService.create(any(UnplannedWorkRequest.class)))
				.thenReturn(
						new UnplannedWorkResponse(
								9L,
								7L,
								7L,
								LocalDate.of(2026, 10, 5),
								35,
								Instant.parse("2026-10-05T10:00:00Z")));

		mockMvc.perform(
						post("/api/unplanned-work")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "taskId": 7,
										  "workDate": "2026-10-05",
										  "actualMinutes": 35,
										  "currentDate": "2026-10-05",
										  "effortVersion": 2,
										  "finish": true,
										  "checkpoint": {
										    "remainingEffortMinutes": null
										  }
										}
										"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(9))
				.andExpect(jsonPath("$.sourceTaskId").value(7))
				.andExpect(jsonPath("$.taskReferenceId").value(7))
				.andExpect(jsonPath("$.workDate").value("2026-10-05"))
				.andExpect(jsonPath("$.actualMinutes").value(35))
				.andExpect(jsonPath("$.recordedAt").value("2026-10-05T10:00:00Z"));

		ArgumentCaptor<UnplannedWorkRequest> captor =
				ArgumentCaptor.forClass(UnplannedWorkRequest.class);
		verify(unplannedWorkService).create(captor.capture());
		assertThat(captor.getValue().taskId()).isEqualTo(7L);
		assertThat(captor.getValue().workDate()).isEqualTo(LocalDate.of(2026, 10, 5));
		assertThat(captor.getValue().actualMinutes()).isEqualTo(35);
		assertThat(captor.getValue().currentDate()).isEqualTo(LocalDate.of(2026, 10, 5));
		assertThat(captor.getValue().effortVersion()).isEqualTo(2);
		assertThat(captor.getValue().finish()).isTrue();
		assertThat(captor.getValue().checkpoint()).isNotNull();
		assertThat(captor.getValue().checkpoint().remainingEffortMinutes()).isNull();
	}

	@Test
	@WithMockUser
	void correct_whenAuthenticated_returns200AndDelegatesById() throws Exception {
		when(unplannedWorkService.correct(eq(9L), any(UnplannedWorkRequest.class)))
				.thenReturn(
						new UnplannedWorkResponse(
								9L,
								7L,
								7L,
								LocalDate.of(2026, 10, 5),
								50,
								Instant.parse("2026-10-05T10:00:00Z")));

		mockMvc.perform(
						put("/api/unplanned-work/9")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "taskId": 7,
										  "workDate": "2026-10-05",
										  "actualMinutes": 50,
										  "currentDate": "2026-10-05",
										  "effortVersion": 1,
										  "finish": false
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(9))
				.andExpect(jsonPath("$.actualMinutes").value(50));

		ArgumentCaptor<UnplannedWorkRequest> captor =
				ArgumentCaptor.forClass(UnplannedWorkRequest.class);
		verify(unplannedWorkService).correct(eq(9L), captor.capture());
		assertThat(captor.getValue().actualMinutes()).isEqualTo(50);
		assertThat(captor.getValue().effortVersion()).isEqualTo(1);
	}

	@Test
	@WithMockUser
	void correct_whenEffortVersionIsStale_returns409WithCode() throws Exception {
		when(unplannedWorkService.correct(eq(9L), any(UnplannedWorkRequest.class)))
				.thenThrow(new ConflictException("PROGRESS_CONFLICT", "task effort has changed"));

		mockMvc.perform(
						put("/api/unplanned-work/9")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "taskId": 7,
										  "workDate": "2026-10-05",
										  "actualMinutes": 50,
										  "currentDate": "2026-10-05",
										  "effortVersion": 0,
										  "finish": false
										}
										"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.status").value(409))
				.andExpect(jsonPath("$.code").value("PROGRESS_CONFLICT"));
	}

	@Test
	void delete_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(delete("/api/unplanned-work/9").with(csrf()))
				.andExpect(status().isUnauthorized());

		verify(unplannedWorkService, never()).delete(any(Long.class), eq(null));
	}

	@Test
	@WithMockUser
	void delete_whenAuthenticatedWithEffortVersion_returns204AndDelegates() throws Exception {
		mockMvc.perform(delete("/api/unplanned-work/9?effortVersion=1").with(csrf()))
				.andExpect(status().isNoContent());

		verify(unplannedWorkService).delete(9L, 1);
	}

	@Test
	@WithMockUser
	void delete_whenEffortVersionIsOmitted_returns204AndPassesNull() throws Exception {
		mockMvc.perform(delete("/api/unplanned-work/9").with(csrf()))
				.andExpect(status().isNoContent());

		verify(unplannedWorkService).delete(9L, null);
	}
}
