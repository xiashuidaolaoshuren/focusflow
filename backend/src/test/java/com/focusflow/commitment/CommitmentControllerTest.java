package com.focusflow.commitment;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.commitment.dto.CommitmentRequest;
import com.focusflow.commitment.dto.CommitmentResponse;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = CommitmentController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class CommitmentControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockBean
	private CommitmentService commitmentService;

	@MockBean
	private FocusFlowUserDetailsService userDetailsService;

	@Test
	void list_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/commitments").param("from", "2026-09-20").param("to", "2026-09-22"))
				.andExpect(status().isUnauthorized());

		verify(commitmentService, never()).list(any(LocalDate.class), any(LocalDate.class));
	}

	@Test
	@WithMockUser
	void list_whenMissingFrom_returns400() throws Exception {
		when(commitmentService.list(null, LocalDate.of(2026, 9, 22)))
				.thenThrow(new com.focusflow.common.error.BadRequestException("from and to are required"));

		mockMvc.perform(get("/api/commitments").param("to", "2026-09-22"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("from and to are required"));
	}

	@Test
	void create_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						post("/api/commitments")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Standup",
										  "commitmentDate": "2026-09-21",
										  "startTime": "10:00:00",
										  "endTime": "10:30:00"
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(commitmentService, never()).create(any(CommitmentRequest.class));
	}

	@Test
	@WithMockUser
	void create_whenServiceRejectsInvalidCommitment_returns400WithMessage() throws Exception {
		when(commitmentService.create(any(CommitmentRequest.class)))
				.thenThrow(new BadRequestException("commitments must not overlap on the same date"));

		mockMvc.perform(
						post("/api/commitments")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Standup",
										  "commitmentDate": "2026-09-21",
										  "startTime": "10:00:00",
										  "endTime": "10:30:00"
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("commitments must not overlap on the same date"));
	}

	@Test
	@WithMockUser
	void create_whenAuthenticated_returns201AndBody() throws Exception {
		when(commitmentService.create(any(CommitmentRequest.class)))
				.thenReturn(
						new CommitmentResponse(
								1L,
								"Standup",
								LocalDate.of(2026, 9, 21),
								LocalTime.of(10, 0),
								LocalTime.of(10, 30)));

		mockMvc.perform(
						post("/api/commitments")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Standup",
										  "commitmentDate": "2026-09-21",
										  "startTime": "10:00:00",
										  "endTime": "10:30:00"
										}
										"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.title").value("Standup"))
				.andExpect(jsonPath("$.commitmentDate").value("2026-09-21"));
	}

	@Test
	void delete_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(delete("/api/commitments/1").with(csrf()))
				.andExpect(status().isUnauthorized());

		verify(commitmentService, never()).delete(1L);
	}

	@Test
	@WithMockUser
	void delete_whenAuthenticated_returns204() throws Exception {
		mockMvc.perform(delete("/api/commitments/1").with(csrf()))
				.andExpect(status().isNoContent());

		verify(commitmentService).delete(1L);
	}

	@Test
	@WithMockUser
	void delete_whenNotFound_returns404WithStandardBody() throws Exception {
		org.mockito.Mockito.doThrow(new NotFoundException("commitment not found"))
				.when(commitmentService)
				.delete(99L);

		mockMvc.perform(delete("/api/commitments/99").with(csrf()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("commitment not found"))
				.andExpect(jsonPath("$.path").value("/api/commitments/99"));
	}

	@Test
	void update_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						put("/api/commitments/1")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Standup",
										  "commitmentDate": "2026-09-21",
										  "startTime": "10:00:00",
										  "endTime": "10:30:00"
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(commitmentService, never()).update(any(Long.class), any(CommitmentRequest.class));
	}

	@Test
	@WithMockUser
	void update_whenNotFound_returns404WithStandardBody() throws Exception {
		when(commitmentService.update(eq(99L), any(CommitmentRequest.class)))
				.thenThrow(new NotFoundException("commitment not found"));

		mockMvc.perform(
						put("/api/commitments/99")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Standup",
										  "commitmentDate": "2026-09-21",
										  "startTime": "10:00:00",
										  "endTime": "10:30:00"
										}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("commitment not found"))
				.andExpect(jsonPath("$.path").value("/api/commitments/99"));
	}

	@Test
	@WithMockUser
	void update_whenAuthenticated_returns200AndBody() throws Exception {
		when(commitmentService.update(eq(1L), any(CommitmentRequest.class)))
				.thenReturn(
						new CommitmentResponse(
								1L,
								"Updated",
								LocalDate.of(2026, 9, 22),
								LocalTime.of(14, 0),
								LocalTime.of(15, 0)));

		mockMvc.perform(
						put("/api/commitments/1")
								.with(csrf())
								.contentType(org.springframework.http.MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated",
										  "commitmentDate": "2026-09-22",
										  "startTime": "14:00:00",
										  "endTime": "15:00:00"
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.title").value("Updated"))
				.andExpect(jsonPath("$.commitmentDate").value("2026-09-22"));
	}

	@Test
	@WithMockUser
	void list_whenAuthenticated_returns200AndBody() throws Exception {
		when(commitmentService.list(LocalDate.of(2026, 9, 20), LocalDate.of(2026, 9, 22)))
				.thenReturn(
						List.of(
								new CommitmentResponse(
										1L,
										"Standup",
										LocalDate.of(2026, 9, 21),
										LocalTime.of(10, 0),
										LocalTime.of(10, 30))));

		mockMvc.perform(
						get("/api/commitments")
								.param("from", "2026-09-20")
								.param("to", "2026-09-22"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].title").value("Standup"))
				.andExpect(jsonPath("$[0].commitmentDate").value("2026-09-21"));
	}
}
