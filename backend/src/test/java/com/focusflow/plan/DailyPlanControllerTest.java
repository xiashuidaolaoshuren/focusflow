package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.ai.AiProviderException;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanItemResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.GeneratePlanRequest;
import java.util.Optional;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import com.focusflow.task.dto.TaskResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = DailyPlanController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class DailyPlanControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockBean
	private DailyPlanService dailyPlanService;

	@MockBean
	private FocusFlowUserDetailsService userDetailsService;

	@Test
	void generate_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(dailyPlanService, never()).generate(any(GeneratePlanRequest.class));
	}

	@Test
	@WithMockUser
	void generate_withInvalidAvailableMinutes_returns400WithDetails() throws Exception {
		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 0
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/generate"))
				.andExpect(jsonPath("$.details.availableMinutes").isArray());

		verify(dailyPlanService, never()).generate(any(GeneratePlanRequest.class));
	}

	@Test
	@WithMockUser
	void generate_whenPlanDateMissing_returns400WithDetails() throws Exception {
		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/generate"))
				.andExpect(jsonPath("$.details.planDate").isArray());

		verify(dailyPlanService, never()).generate(any(GeneratePlanRequest.class));
	}

	@Test
	@WithMockUser
	void generate_passesReplacePlanIdToService() throws Exception {
		when(dailyPlanService.generate(any(GeneratePlanRequest.class)))
				.thenReturn(
						new DailyPlanResponse(
								1L,
								LocalDate.of(2026, 6, 1),
								Instant.parse("2026-06-01T09:00:00Z"),
								List.of(),
								120,
								null));

		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120,
										  "planDate": "2026-06-01",
										  "replacePlanId": 5
										}
										"""))
				.andExpect(status().isCreated());

		ArgumentCaptor<GeneratePlanRequest> captor = ArgumentCaptor.forClass(GeneratePlanRequest.class);
		verify(dailyPlanService).generate(captor.capture());
		assertThat(captor.getValue().replacePlanId()).isEqualTo(5L);
	}

	@Test
	@WithMockUser
	void generate_whenNoPlannableTasks_returns400WithMessage() throws Exception {
		when(dailyPlanService.generate(any(GeneratePlanRequest.class)))
				.thenThrow(new BadRequestException("no plannable tasks available for planning"));

		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 60,
										  "planDate": "2026-06-01"
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.message").value("no plannable tasks available for planning"))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/generate"));
	}

	@Test
	@WithMockUser
	void generate_whenAuthenticated_returns201AndBody() throws Exception {
		when(dailyPlanService.generate(any(GeneratePlanRequest.class)))
				.thenReturn(
						new DailyPlanResponse(
								1L,
								LocalDate.of(2026, 6, 1),
								Instant.parse("2026-06-01T09:00:00Z"),
								List.of(
										new DailyPlanItemResponse(
												1,
												new TaskResponse(
														10L,
														"Write tests",
														null,
														TaskPriority.HIGH,
														TaskStatus.OPEN,
														null,
														45))),
								null,
								null));

		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120,
										  "planDate": "2026-06-01"
										}
										"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.planDate").value("2026-06-01"))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].position").value(1))
				.andExpect(jsonPath("$.items[0].task.title").value("Write tests"));
	}

	@Test
	@WithMockUser
	void generate_whenResponseIncludesWarning_rendersAvailableMinutesAndWarningJson() throws Exception {
		when(dailyPlanService.generate(any(GeneratePlanRequest.class)))
				.thenReturn(
						new DailyPlanResponse(
								1L,
								LocalDate.of(2026, 6, 1),
								Instant.parse("2026-06-01T09:00:00Z"),
								List.of(
										new DailyPlanItemResponse(
												1,
												new TaskResponse(
														10L,
														"Write tests",
														null,
														TaskPriority.HIGH,
														TaskStatus.OPEN,
														null,
														45))),
								120,
								new DailyPlanWarning(
										90,
										List.of(new DailyPlanWarning.EstimatedTask(10L, "Write tests", 90)),
										List.of())));

		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120,
										  "planDate": "2026-06-01"
										}
										"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.availableMinutes").value(120))
				.andExpect(jsonPath("$.warning.minimumAvailableMinutes").value(90))
				.andExpect(jsonPath("$.warning.estimatedTasks.length()").value(1))
				.andExpect(jsonPath("$.warning.estimatedTasks[0].taskId").value(10))
				.andExpect(jsonPath("$.warning.estimatedTasks[0].title").value("Write tests"))
				.andExpect(jsonPath("$.warning.estimatedTasks[0].estimatedMinutes").value(90));
	}

	@Test
	@WithMockUser
	void generate_whenAiProviderFails_returns502WithStandardBody() throws Exception {
		when(dailyPlanService.generate(any(GeneratePlanRequest.class)))
				.thenThrow(new AiProviderException("provider down"));

		mockMvc.perform(
						post("/api/daily-plans/generate")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "availableMinutes": 120,
										  "planDate": "2026-06-01"
										}
										"""))
				.andExpect(status().isBadGateway())
				.andExpect(jsonPath("$.status").value(502))
				.andExpect(jsonPath("$.message").value("provider down"))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/generate"));
	}

	@Test
	void list_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/daily-plans"))
				.andExpect(status().isUnauthorized());

		verify(dailyPlanService, never()).listForCurrentUser(any(Integer.class), any(Integer.class));
	}

	@Test
	@WithMockUser
	void list_whenAuthenticated_returns200AndPagedSummaries() throws Exception {
		when(dailyPlanService.listForCurrentUser(0, 20))
				.thenReturn(
						new PageResponse<>(
								List.of(
										new DailyPlanSummaryResponse(
												1L,
												LocalDate.of(2026, 6, 1),
												Instant.parse("2026-06-01T09:00:00Z"),
												1,
												false,
												120)),
								0,
								20,
								1L,
								1));

		mockMvc.perform(get("/api/daily-plans"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content.length()").value(1))
				.andExpect(jsonPath("$.content[0].id").value(1))
				.andExpect(jsonPath("$.content[0].planDate").value("2026-06-01"))
				.andExpect(jsonPath("$.content[0].itemCount").value(1))
				.andExpect(jsonPath("$.content[0].hasWarning").value(false))
				.andExpect(jsonPath("$.content[0].availableMinutes").value(120))
				.andExpect(jsonPath("$.page").value(0))
				.andExpect(jsonPath("$.size").value(20))
				.andExpect(jsonPath("$.totalElements").value(1))
				.andExpect(jsonPath("$.totalPages").value(1));

		verify(dailyPlanService).listForCurrentUser(0, 20);
	}

	@Test
	@WithMockUser
	void list_whenPageAndSizeProvided_passesPaginationToService() throws Exception {
		when(dailyPlanService.listForCurrentUser(2, 10))
				.thenReturn(new PageResponse<>(List.of(), 2, 10, 0L, 0));

		mockMvc.perform(get("/api/daily-plans").param("page", "2").param("size", "10"))
				.andExpect(status().isOk());

		verify(dailyPlanService).listForCurrentUser(2, 10);
	}

	@Test
	@WithMockUser
	void latest_whenPlanExists_returns200AndBody() throws Exception {
		when(dailyPlanService.latestForCurrentUser(LocalDate.of(2026, 6, 1)))
				.thenReturn(
						Optional.of(
								new DailyPlanResponse(
										1L,
										LocalDate.of(2026, 6, 1),
										Instant.parse("2026-06-01T09:00:00Z"),
										List.of(
												new DailyPlanItemResponse(
														1,
														new TaskResponse(
																10L,
																"Write tests",
																null,
																TaskPriority.HIGH,
																TaskStatus.OPEN,
																null,
																45))),
										120,
										null)));

		mockMvc.perform(get("/api/daily-plans/latest").param("planDate", "2026-06-01"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.planDate").value("2026-06-01"))
				.andExpect(jsonPath("$.items.length()").value(1));
	}

	@Test
	@WithMockUser
	void latest_whenNoPlanExists_returns204() throws Exception {
		when(dailyPlanService.latestForCurrentUser(LocalDate.of(2026, 6, 1)))
				.thenReturn(Optional.empty());

		mockMvc.perform(get("/api/daily-plans/latest").param("planDate", "2026-06-01"))
				.andExpect(status().isNoContent());
	}

	@Test
	@WithMockUser
	void latest_whenPlanDateMissing_returns400WithMessage() throws Exception {
		when(dailyPlanService.latestForCurrentUser(null))
				.thenThrow(new BadRequestException("planDate is required"));

		mockMvc.perform(get("/api/daily-plans/latest"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.message").value("planDate is required"))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/latest"));
	}

	@Test
	void getById_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/daily-plans/1"))
				.andExpect(status().isUnauthorized());

		verify(dailyPlanService, never()).getForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void getById_whenAuthenticated_returns200AndBody() throws Exception {
		when(dailyPlanService.getForCurrentUser(1L))
				.thenReturn(
						new DailyPlanResponse(
								1L,
								LocalDate.of(2026, 6, 1),
								Instant.parse("2026-06-01T09:00:00Z"),
								List.of(
										new DailyPlanItemResponse(
												1,
												new TaskResponse(
														10L,
														"Write tests",
														null,
														TaskPriority.HIGH,
														TaskStatus.OPEN,
														null,
														45))),
								null,
								null));

		mockMvc.perform(get("/api/daily-plans/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.planDate").value("2026-06-01"))
				.andExpect(jsonPath("$.items.length()").value(1))
				.andExpect(jsonPath("$.items[0].task.title").value("Write tests"));
	}

	@Test
	@WithMockUser
	void getById_whenNotFound_returns404WithStandardBody() throws Exception {
		when(dailyPlanService.getForCurrentUser(99L))
				.thenThrow(new NotFoundException("daily plan not found"));

		mockMvc.perform(get("/api/daily-plans/99"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("daily plan not found"))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/99"));
	}

	@Test
	void delete_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(delete("/api/daily-plans/1").with(csrf()))
				.andExpect(status().isUnauthorized());

		verify(dailyPlanService, never()).deleteForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void delete_whenAuthenticated_returns204() throws Exception {
		mockMvc.perform(delete("/api/daily-plans/1").with(csrf()))
				.andExpect(status().isNoContent());

		verify(dailyPlanService).deleteForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void delete_whenNotFound_returns404WithStandardBody() throws Exception {
		org.mockito.Mockito.doThrow(new NotFoundException("daily plan not found"))
				.when(dailyPlanService)
				.deleteForCurrentUser(99L);

		mockMvc.perform(delete("/api/daily-plans/99").with(csrf()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("daily plan not found"))
				.andExpect(jsonPath("$.path").value("/api/daily-plans/99"));
	}
}
