package com.focusflow.task;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.focusflow.common.error.GlobalExceptionHandler;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.FocusFlowUserDetailsService;
import com.focusflow.security.SecurityConfig;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.task.dto.UpdateTaskRequest;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = TaskController.class)
@Import({SecurityConfig.class, GlobalExceptionHandler.class})
class TaskControllerTest {

	@Autowired
	private MockMvc mockMvc;

	@MockBean
	private TaskService taskService;

	@MockBean
	private FocusFlowUserDetailsService userDetailsService;

	@Test
	void create_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						post("/api/tasks")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Write tests"
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(taskService, never()).create(any(CreateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void create_withBlankTitle_returns400WithDetails() throws Exception {
		mockMvc.perform(
						post("/api/tasks")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": ""
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/tasks"))
				.andExpect(jsonPath("$.details.title").isArray());

		verify(taskService, never()).create(any(CreateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void create_withNonPositiveEstimatedMinutes_returns400WithDetails() throws Exception {
		mockMvc.perform(
						post("/api/tasks")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Write tests",
										  "estimatedMinutes": 0
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/tasks"))
				.andExpect(jsonPath("$.details.estimatedMinutes").isArray());
		mockMvc.perform(
						post("/api/tasks")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Write tests",
										  "estimatedMinutes": -30
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.details.estimatedMinutes").isArray());

		verify(taskService, never()).create(any(CreateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void create_whenAuthenticated_returns201AndBody() throws Exception {
		when(taskService.create(any(CreateTaskRequest.class)))
				.thenReturn(
						new TaskResponse(
								1L,
								"Write tests",
								"TDD coverage",
								com.focusflow.task.TaskPriority.HIGH,
								com.focusflow.task.TaskStatus.OPEN,
								null,
								45));

		mockMvc.perform(
						post("/api/tasks")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Write tests",
										  "description": "TDD coverage",
										  "priority": "HIGH",
										  "estimatedMinutes": 45
										}
										"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.title").value("Write tests"))
				.andExpect(jsonPath("$.priority").value("HIGH"))
				.andExpect(jsonPath("$.status").value("OPEN"));
	}

	@Test
	@WithMockUser
	void list_whenAuthenticated_returnsOnlyCurrentUserTasks() throws Exception {
		when(taskService.listForCurrentUser())
				.thenReturn(
						List.of(
								new TaskResponse(
										1L,
										"Task A",
										null,
										com.focusflow.task.TaskPriority.MEDIUM,
										com.focusflow.task.TaskStatus.OPEN,
										null,
										null),
								new TaskResponse(
										2L,
										"Task B",
										"Details",
										com.focusflow.task.TaskPriority.LOW,
										com.focusflow.task.TaskStatus.DONE,
										null,
										30)));

		mockMvc.perform(get("/api/tasks"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].title").value("Task A"))
				.andExpect(jsonPath("$[1].title").value("Task B"));
	}

	@Test
	void getById_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(get("/api/tasks/1"))
				.andExpect(status().isUnauthorized());

		verify(taskService, never()).getForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void getById_whenAuthenticated_returns200AndBody() throws Exception {
		when(taskService.getForCurrentUser(1L))
				.thenReturn(
						new TaskResponse(
								1L,
								"Task A",
								"Details",
								com.focusflow.task.TaskPriority.HIGH,
								com.focusflow.task.TaskStatus.OPEN,
								null,
								45));

		mockMvc.perform(get("/api/tasks/1"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.title").value("Task A"))
				.andExpect(jsonPath("$.description").value("Details"))
				.andExpect(jsonPath("$.priority").value("HIGH"))
				.andExpect(jsonPath("$.status").value("OPEN"))
				.andExpect(jsonPath("$.estimatedMinutes").value(45));
	}

	@Test
	@WithMockUser
	void getById_whenNotFound_returns404WithStandardBody() throws Exception {
		when(taskService.getForCurrentUser(99L))
				.thenThrow(new NotFoundException("task not found"));

		mockMvc.perform(get("/api/tasks/99"))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("task not found"))
				.andExpect(jsonPath("$.path").value("/api/tasks/99"));
	}

	@Test
	void update_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(
						put("/api/tasks/1")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated"
										}
										"""))
				.andExpect(status().isUnauthorized());

		verify(taskService, never()).updateForCurrentUser(any(Long.class), any(UpdateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void update_withBlankTitle_returns400WithDetails() throws Exception {
		mockMvc.perform(
						put("/api/tasks/1")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": ""
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/tasks/1"))
				.andExpect(jsonPath("$.details.title").isArray());

		verify(taskService, never()).updateForCurrentUser(any(Long.class), any(UpdateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void update_withNonPositiveEstimatedMinutes_returns400WithDetails() throws Exception {
		mockMvc.perform(
						put("/api/tasks/1")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated task",
										  "estimatedMinutes": 0
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.status").value(400))
				.andExpect(jsonPath("$.path").value("/api/tasks/1"))
				.andExpect(jsonPath("$.details.estimatedMinutes").isArray());
		mockMvc.perform(
						put("/api/tasks/1")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated task",
										  "estimatedMinutes": -30
										}
										"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.details.estimatedMinutes").isArray());

		verify(taskService, never())
				.updateForCurrentUser(any(Long.class), any(UpdateTaskRequest.class));
	}

	@Test
	@WithMockUser
	void update_whenAuthenticated_returns200AndBody() throws Exception {
		when(taskService.updateForCurrentUser(any(Long.class), any(UpdateTaskRequest.class)))
				.thenReturn(
						new TaskResponse(
								1L,
								"Updated task",
								"Updated details",
								com.focusflow.task.TaskPriority.HIGH,
								com.focusflow.task.TaskStatus.DONE,
								null,
								60));

		mockMvc.perform(
						put("/api/tasks/1")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated task",
										  "description": "Updated details",
										  "priority": "HIGH",
										  "status": "DONE",
										  "estimatedMinutes": 60
										}
										"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(1))
				.andExpect(jsonPath("$.title").value("Updated task"))
				.andExpect(jsonPath("$.status").value("DONE"));
	}

	@Test
	@WithMockUser
	void update_whenNotFound_returns404WithStandardBody() throws Exception {
		when(taskService.updateForCurrentUser(any(Long.class), any(UpdateTaskRequest.class)))
				.thenThrow(new NotFoundException("task not found"));

		mockMvc.perform(
						put("/api/tasks/99")
								.with(csrf())
								.contentType(MediaType.APPLICATION_JSON)
								.content(
										"""
										{
										  "title": "Updated task"
										}
										"""))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("task not found"))
				.andExpect(jsonPath("$.path").value("/api/tasks/99"));
	}

	@Test
	void delete_whenUnauthenticated_returns401() throws Exception {
		mockMvc.perform(delete("/api/tasks/1").with(csrf()))
				.andExpect(status().isUnauthorized());

		verify(taskService, never()).deleteForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void delete_whenAuthenticated_returns204() throws Exception {
		mockMvc.perform(delete("/api/tasks/1").with(csrf()))
				.andExpect(status().isNoContent());

		verify(taskService).deleteForCurrentUser(1L);
	}

	@Test
	@WithMockUser
	void delete_whenNotFound_returns404WithStandardBody() throws Exception {
		org.mockito.Mockito.doThrow(new NotFoundException("task not found"))
				.when(taskService)
				.deleteForCurrentUser(99L);

		mockMvc.perform(delete("/api/tasks/99").with(csrf()))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.status").value(404))
				.andExpect(jsonPath("$.message").value("task not found"))
				.andExpect(jsonPath("$.path").value("/api/tasks/99"));
	}
}
