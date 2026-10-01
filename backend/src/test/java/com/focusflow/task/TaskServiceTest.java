package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.task.dto.UpdateTaskRequest;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

	@Mock
	private TaskRepository taskRepository;

	@Mock
	private UserRepository userRepository;

	@Mock
	private CurrentUser currentUser;

	private final TaskResponseMapper taskResponseMapper = new TaskResponseMapper();

	private TaskService taskService;

	@BeforeEach
	void setUp() {
		taskService =
				new TaskService(
						taskRepository, userRepository, currentUser, taskResponseMapper);
	}

	@Test
	void create_bindsOwnerFromCurrentUser() {
		UserContext current = new UserContext(42L, "owner@example.com", "owner");
		when(currentUser.getCurrentUser()).thenReturn(current);

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(userRepository.findById(42L)).thenReturn(Optional.of(owner));

		when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

		taskService.create(new CreateTaskRequest("My task", null, TaskPriority.HIGH, null, null));

		ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
		verify(taskRepository).save(captor.capture());
		assertThat(captor.getValue().getOwner()).isSameAs(owner);
	}

	@Test
	void create_defaultsStatusOpenAndPriorityMediumWhenOmitted() {
		UserContext current = new UserContext(42L, "owner@example.com", "owner");
		when(currentUser.getCurrentUser()).thenReturn(current);

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(userRepository.findById(42L)).thenReturn(Optional.of(owner));
		when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

		taskService.create(new CreateTaskRequest("My task", null, null, null, null));

		ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
		verify(taskRepository).save(captor.capture());
		assertThat(captor.getValue().getStatus()).isEqualTo(TaskStatus.OPEN);
		assertThat(captor.getValue().getPriority()).isEqualTo(TaskPriority.MEDIUM);
	}

	@Test
	void create_withNonPositiveEstimatedMinutes_throwsBadRequestAndDoesNotSave() {
		assertThatThrownBy(
						() -> taskService.create(new CreateTaskRequest("My task", null, null, null, 0)))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("estimated minutes must be null or positive");
		assertThatThrownBy(
						() -> taskService.create(new CreateTaskRequest("My task", null, null, null, -1)))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("estimated minutes must be null or positive");

		verify(taskRepository, never()).save(any(Task.class));
	}

	@Test
	void list_fetchesByOwnerId() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Listed");
		when(taskRepository.findByOwner_IdOrderByDueDateAsc(42L)).thenReturn(List.of(task));

		List<TaskResponse> responses = taskService.listForCurrentUser();

		verify(taskRepository).findByOwner_IdOrderByDueDateAsc(eq(42L));
		assertThat(responses).singleElement().satisfies(r -> assertThat(r.title()).isEqualTo("Listed"));
	}

	@Test
	void getForCurrentUser_whenTaskOwnedByCurrentUser_returnsTaskResponse() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("My task");
		task.setDescription("Details");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));

		TaskResponse response = taskService.getForCurrentUser(7L);

		verify(taskRepository).findByOwner_IdAndId(eq(42L), eq(7L));
		assertThat(response.title()).isEqualTo("My task");
		assertThat(response.description()).isEqualTo("Details");
		assertThat(response.priority()).isEqualTo(TaskPriority.HIGH);
		assertThat(response.status()).isEqualTo(TaskStatus.OPEN);
	}

	@Test
	void getForCurrentUser_whenTaskMissingOrNotOwned_throwsNotFoundException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(taskRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> taskService.getForCurrentUser(99L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");
	}

	@Test
	void updateForCurrentUser_whenOwned_updatesFieldsAndReturnsResponse() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Old title");
		task.setDescription("Old description");
		task.setPriority(TaskPriority.LOW);
		task.setStatus(TaskStatus.OPEN);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"New title",
						"New description",
						TaskPriority.HIGH,
						TaskStatus.DONE,
						LocalDate.of(2026, 6, 1),
						90);

		TaskResponse response = taskService.updateForCurrentUser(7L, request);

		assertThat(task.getTitle()).isEqualTo("New title");
		assertThat(task.getDescription()).isEqualTo("New description");
		assertThat(task.getPriority()).isEqualTo(TaskPriority.HIGH);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.DONE);
		assertThat(task.getDueDate()).isEqualTo(LocalDate.of(2026, 6, 1));
		assertThat(task.getEstimatedMinutes()).isEqualTo(90);
		assertThat(response.title()).isEqualTo("New title");
		assertThat(response.status()).isEqualTo(TaskStatus.DONE);
		verify(taskRepository).save(task);
	}

	@Test
	void updateForCurrentUser_withNonPositiveEstimatedMinutes_throwsBadRequestAndDoesNotSave() {
		UpdateTaskRequest zeroEstimate =
				new UpdateTaskRequest("New title", null, null, null, null, 0);
		assertThatThrownBy(() -> taskService.updateForCurrentUser(7L, zeroEstimate))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("estimated minutes must be null or positive");
		UpdateTaskRequest negativeEstimate =
				new UpdateTaskRequest("New title", null, null, null, null, -1);
		assertThatThrownBy(() -> taskService.updateForCurrentUser(7L, negativeEstimate))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("estimated minutes must be null or positive");

		verify(taskRepository, never()).save(any(Task.class));
	}

	@Test
	void updateForCurrentUser_whenNotOwned_throwsNotFoundException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(taskRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(Optional.empty());

		UpdateTaskRequest request =
				new UpdateTaskRequest("New title", null, null, null, null, null);

		assertThatThrownBy(() -> taskService.updateForCurrentUser(99L, request))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");
	}

	@Test
	void deleteForCurrentUser_whenOwned_deletesTask() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("To delete");
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));

		taskService.deleteForCurrentUser(7L);

		verify(taskRepository).delete(task);
	}

	@Test
	void deleteForCurrentUser_whenNotOwned_throwsNotFoundException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(taskRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> taskService.deleteForCurrentUser(99L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");

		verify(taskRepository, never()).delete(any(Task.class));
	}
}
