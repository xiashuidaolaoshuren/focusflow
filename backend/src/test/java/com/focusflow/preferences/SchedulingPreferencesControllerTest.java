package com.focusflow.preferences;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.preferences.dto.SchedulingPreferencesRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesResponse;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = SchedulingPreferencesController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class SchedulingPreferencesControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockBean
	private SchedulingPreferencesService schedulingPreferencesService;

	@MockBean
	private FocusFlowUserDetailsService userDetailsService;

	@Test
	void getEffective_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/scheduling-preferences"))
				.andExpect(status().isUnauthorized());

		verify(schedulingPreferencesService, never()).getEffective();
	}

	@Test
	@WithMockUser
	void getEffective_whenAuthenticated_returns200AndBody() throws Exception {
		when(schedulingPreferencesService.getEffective())
				.thenReturn(
						new SchedulingPreferencesResponse(
								LocalTime.of(9, 0),
								LocalTime.of(18, 0),
								true,
								50,
								10,
								15,
								0,
								null,
								null,
								List.of(),
								false));

		mockMvc.perform(get("/api/scheduling-preferences"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.workDayStart").value("09:00:00"))
				.andExpect(jsonPath("$.workDayEnd").value("18:00:00"))
				.andExpect(jsonPath("$.cadenceEnabled").value(true))
				.andExpect(jsonPath("$.persisted").value(false));
	}

	@Test
	void put_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						put("/api/scheduling-preferences")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "workDayStart": "09:00:00",
										  "workDayEnd": "18:00:00",
										  "cadenceEnabled": true,
										  "targetFocusMinutes": 50,
										  "breakMinutes": 10,
										  "minSessionMinutes": 15,
										  "bufferMinutes": 0,
										  "fixedBreaks": []
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(schedulingPreferencesService, never()).put(any(SchedulingPreferencesRequest.class));
	}

	@Test
	@WithMockUser
	void put_whenServiceRejectsInvalidPreferences_returns400WithMessage() throws Exception {
		when(schedulingPreferencesService.put(any(SchedulingPreferencesRequest.class)))
				.thenThrow(new BadRequestException("work day end must be after work day start"));

		mockMvc.perform(
						put("/api/scheduling-preferences")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "workDayStart": "09:00:00",
										  "workDayEnd": "18:00:00",
										  "cadenceEnabled": true,
										  "targetFocusMinutes": 50,
										  "breakMinutes": 10,
										  "minSessionMinutes": 15,
										  "bufferMinutes": 0,
										  "fixedBreaks": []
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.message").value("work day end must be after work day start"))
				.andExpect(jsonPath("$.path").value("/api/scheduling-preferences"));
	}

	@Test
	@WithMockUser
	void put_whenAuthenticated_returns200AndBody() throws Exception {
		when(schedulingPreferencesService.put(any(SchedulingPreferencesRequest.class)))
				.thenReturn(
						new SchedulingPreferencesResponse(
								LocalTime.of(9, 0),
								LocalTime.of(18, 0),
								true,
								50,
								10,
								15,
								0,
								null,
								null,
								List.of(),
								true));

		mockMvc.perform(
						put("/api/scheduling-preferences")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "workDayStart": "09:00:00",
										  "workDayEnd": "18:00:00",
										  "cadenceEnabled": true,
										  "targetFocusMinutes": 50,
										  "breakMinutes": 10,
										  "minSessionMinutes": 15,
										  "bufferMinutes": 0,
										  "fixedBreaks": []
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.persisted").value(true));
	}
}
