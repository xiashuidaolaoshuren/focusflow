package com.focusflow.plan;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.dependency.BrokenDependencyOrderException;
import com.focusflow.plan.dto.HorizonResponse;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import com.focusflow.task.TaskStatus;
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

@WebMvcTest(controllers = HorizonController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class HorizonControllerTest {

	@Autowired private MockMvc mockMvc;

	@MockBean private HorizonService horizonService;
	@MockBean private FocusFlowUserDetailsService userDetailsService;

	@Test
	void horizon_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/horizon").param("currentDate", "2026-06-01").param("currentTime", "09:00"))
				.andExpect(status().isUnauthorized());
	}

	@Test
	@WithMockUser
	void horizon_whenAuthenticated_returns200WithResponseShape() throws Exception {
		HorizonResponse response =
				new HorizonResponse(
						LocalDate.of(2026, 6, 1),
						LocalTime.of(9, 0),
						new HorizonResponse.Assumptions(
								"AS_PLANNED",
								List.of(java.time.DayOfWeek.MONDAY),
								7),
						List.of(
								new HorizonResponse.DayResponse(
										LocalDate.of(2026, 6, 1),
										com.focusflow.horizon.HorizonForecast.DayKind.FORECAST,
										null,
										null,
										List.of())),
						List.of(
								new HorizonResponse.TaskRowResponse(
										1L,
										"Task",
										TaskStatus.OPEN,
										null,
										30,
										null,
										null,
										List.of(),
										List.of(),
										List.of(),
										List.of(
												new HorizonResponse.SegmentResponse(
														LocalDate.of(2026, 6, 1),
														30,
														30,
														List.of(),
														null,
														null,
														null)))));
		when(horizonService.read(eq(LocalDate.of(2026, 6, 1)), eq(LocalTime.of(9, 0))))
				.thenReturn(response);

		mockMvc.perform(get("/api/horizon").param("currentDate", "2026-06-01").param("currentTime", "09:00"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.currentDate").value("2026-06-01"))
				.andExpect(jsonPath("$.currentTime").value("09:00:00"))
				.andExpect(jsonPath("$.assumptions.pace").value("AS_PLANNED"))
				.andExpect(jsonPath("$.assumptions.horizonWorkingDays").value(7))
				.andExpect(jsonPath("$.days[0].kind").value("FORECAST"))
				.andExpect(jsonPath("$.tasks[0].taskId").value(1))
				.andExpect(jsonPath("$.tasks[0].segments[0].minutes").value(30));
	}

	@Test
	@WithMockUser
	void horizon_missingParams_returns400() throws Exception {
		when(horizonService.read(null, LocalTime.of(9, 0)))
				.thenThrow(new BadRequestException("currentDate is required"));

		mockMvc.perform(get("/api/horizon").param("currentTime", "09:00"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("currentDate is required"));
	}

	@Test
	@WithMockUser
	void horizon_unalignedTime_returns400() throws Exception {
		when(horizonService.read(LocalDate.of(2026, 6, 1), LocalTime.of(9, 0, 15)))
				.thenThrow(new BadRequestException("times must be minute-aligned"));

		mockMvc.perform(
						get("/api/horizon")
								.param("currentDate", "2026-06-01")
								.param("currentTime", "09:00:15"))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.message").value("times must be minute-aligned"));
	}

	@Test
	@WithMockUser
	void horizon_brokenDependencyOrder_returns500WithInvariantMessage() throws Exception {
		when(horizonService.read(LocalDate.of(2026, 6, 1), LocalTime.of(9, 0)))
				.thenThrow(new BrokenDependencyOrderException("dependency order cannot be repaired"));

		mockMvc.perform(get("/api/horizon").param("currentDate", "2026-06-01").param("currentTime", "09:00"))
				.andExpect(status().isInternalServerError())
				.andExpect(jsonPath("$.message").value("dependency order cannot be repaired"));
	}
}
