package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.plan.DailyPlanBlockRepository;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.RemainingEffortRequest;
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
	private RemainingEffortCheckpointRepository remainingEffortCheckpointRepository;

	@Mock
	private DailyPlanBlockRepository dailyPlanBlockRepository;

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
						taskRepository,
						remainingEffortCheckpointRepository,
						dailyPlanBlockRepository,
						userRepository,
						currentUser,
						taskResponseMapper);
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
	void create_initializesRemainingEffortFromEstimate() {
		UserContext current = new UserContext(42L, "owner@example.com", "owner");
		when(currentUser.getCurrentUser()).thenReturn(current);

		User owner = new User();
		when(userRepository.findById(42L)).thenReturn(Optional.of(owner));
		when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

		TaskResponse withEstimate =
				taskService.create(
						new CreateTaskRequest("Estimated", null, TaskPriority.MEDIUM, null, 45));
		TaskResponse withoutEstimate =
				taskService.create(new CreateTaskRequest("Unknown", null, TaskPriority.MEDIUM, null, null));

		assertThat(withEstimate.remainingEffortMinutes()).isEqualTo(45);
		assertThat(withEstimate.effortVersion()).isZero();
		assertThat(withoutEstimate.remainingEffortMinutes()).isNull();
		assertThat(withoutEstimate.effortVersion()).isZero();

		ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
		verify(taskRepository, org.mockito.Mockito.times(2)).save(captor.capture());
		assertThat(captor.getAllValues())
				.allSatisfy(
						task -> {
							assertThat(task.getEffortVersion()).isZero();
						});
		assertThat(captor.getAllValues().get(0).getRemainingEffortMinutes()).isEqualTo(45);
		assertThat(captor.getAllValues().get(1).getRemainingEffortMinutes()).isNull();
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
	void updateForCurrentUser_openEstimateEditCopiesRemainingEffort() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Open task");
		task.setStatus(TaskStatus.OPEN);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(0);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Open task",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						90,
						null,
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getEstimatedMinutes()).isEqualTo(90);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(90);
		assertThat(task.getEffortVersion()).isEqualTo(1);
	}

	@Test
	void updateForCurrentUser_finishSetsDoneAndZeroRemaining() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");

		Task task = new Task();
		task.setOwner(owner);
		task.setTitle("Finish me");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(0);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
		when(remainingEffortCheckpointRepository.save(any(RemainingEffortCheckpoint.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Finish me",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.DONE,
						null,
						60,
						LocalDate.of(2026, 10, 3),
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getStatus()).isEqualTo(TaskStatus.DONE);
		assertThat(task.getRemainingEffortMinutes()).isZero();
		assertThat(task.getEffortVersion()).isEqualTo(1);

		ArgumentCaptor<RemainingEffortCheckpoint> checkpointCaptor =
				ArgumentCaptor.forClass(RemainingEffortCheckpoint.class);
		verify(remainingEffortCheckpointRepository).save(checkpointCaptor.capture());
		assertThat(checkpointCaptor.getValue().getAssessedRemainingMinutes()).isZero();
	}

	@Test
	void updateForCurrentUser_estimateEditAfterProgressKeepsRemainingEffort() throws Exception {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Open task with checkpoint");
		task.setStatus(TaskStatus.OPEN);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(45);
		task.setEffortVersion(2);
		var idField = Task.class.getDeclaredField("id");
		idField.setAccessible(true);
		idField.set(task, 7L);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(remainingEffortCheckpointRepository.existsByTaskReference_Id(7L)).thenReturn(true);
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Open task with checkpoint",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						90,
						null,
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getEstimatedMinutes()).isEqualTo(90);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(45);
		assertThat(task.getEffortVersion()).isEqualTo(2);
	}

	@Test
	void updateForCurrentUser_estimateEditWithBlockOutcomeKeepsRemainingEffort() throws Exception {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Open task with recorded work");
		task.setStatus(TaskStatus.OPEN);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(1);
		var idField = Task.class.getDeclaredField("id");
		idField.setAccessible(true);
		idField.set(task, 7L);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(dailyPlanBlockRepository.existsByDailyPlanTask_TaskReference_IdAndOutcomeIsNotNull(7L))
				.thenReturn(true);
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Open task with recorded work",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						90,
						null,
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getEstimatedMinutes()).isEqualTo(90);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(60);
		assertThat(task.getEffortVersion()).isEqualTo(1);
	}

	@Test
	void updateForCurrentUser_cancelKeepsRemainingEffort() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Cancel me");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(45);
		task.setEffortVersion(2);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Cancel me",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.CANCELLED,
						null,
						60,
						null,
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getStatus()).isEqualTo(TaskStatus.CANCELLED);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(45);
		assertThat(task.getEffortVersion()).isEqualTo(3);
		verify(remainingEffortCheckpointRepository, never()).save(any(RemainingEffortCheckpoint.class));
	}

	@Test
	void updateForCurrentUser_reopenToExplicitUnknown() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");

		Task task = new Task();
		task.setOwner(owner);
		task.setTitle("Done task");
		task.setStatus(TaskStatus.DONE);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(0);
		task.setEffortVersion(3);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
		when(remainingEffortCheckpointRepository.save(any(RemainingEffortCheckpoint.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Done task",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						60,
						LocalDate.of(2026, 10, 3),
						null,
						null);

		taskService.updateForCurrentUser(7L, request);

		assertThat(task.getStatus()).isEqualTo(TaskStatus.OPEN);
		assertThat(task.getRemainingEffortMinutes()).isNull();
		assertThat(task.getEffortVersion()).isEqualTo(4);

		ArgumentCaptor<RemainingEffortCheckpoint> checkpointCaptor =
				ArgumentCaptor.forClass(RemainingEffortCheckpoint.class);
		verify(remainingEffortCheckpointRepository).save(checkpointCaptor.capture());
		assertThat(checkpointCaptor.getValue().getAssessedRemainingMinutes()).isNull();
	}

	@Test
	void updateForCurrentUser_staleEffortVersionConflicts() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Stale version task");
		task.setStatus(TaskStatus.OPEN);
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(3);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));

		UpdateTaskRequest request =
				new UpdateTaskRequest(
						"Stale version task",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						60,
						null,
						null,
						2);

		assertThatThrownBy(() -> taskService.updateForCurrentUser(7L, request))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PROGRESS_CONFLICT"));

		assertThat(task.getTitle()).isEqualTo("Stale version task");
		verify(taskRepository, never()).save(any(Task.class));
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
						TaskStatus.OPEN,
						LocalDate.of(2026, 6, 1),
						90,
						null,
						null,
						null);

		TaskResponse response = taskService.updateForCurrentUser(7L, request);

		assertThat(task.getTitle()).isEqualTo("New title");
		assertThat(task.getDescription()).isEqualTo("New description");
		assertThat(task.getPriority()).isEqualTo(TaskPriority.HIGH);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.OPEN);
		assertThat(task.getDueDate()).isEqualTo(LocalDate.of(2026, 6, 1));
		assertThat(task.getEstimatedMinutes()).isEqualTo(90);
		assertThat(response.title()).isEqualTo("New title");
		assertThat(response.status()).isEqualTo(TaskStatus.OPEN);
		verify(taskRepository).save(task);
	}

	@Test
	void updateForCurrentUser_withNonPositiveEstimatedMinutes_throwsBadRequestAndDoesNotSave() {
		UpdateTaskRequest zeroEstimate =
				new UpdateTaskRequest("New title", null, null, null, null, 0, null, null, null);
		assertThatThrownBy(() -> taskService.updateForCurrentUser(7L, zeroEstimate))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("estimated minutes must be null or positive");
		UpdateTaskRequest negativeEstimate =
				new UpdateTaskRequest("New title", null, null, null, null, -1, null, null, null);
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
				new UpdateTaskRequest("New title", null, null, null, null, null, null, null, null);

		assertThatThrownBy(() -> taskService.updateForCurrentUser(99L, request))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");
	}

	@Test
	void reassessRemainingEffortForCurrentUser_positiveValue() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");

		Task task = new Task();
		task.setOwner(owner);
		task.setTitle("Reassess me");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(2);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
		when(remainingEffortCheckpointRepository.save(any(RemainingEffortCheckpoint.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		RemainingEffortRequest request =
				new RemainingEffortRequest(45, LocalDate.of(2026, 10, 3), 2);

		TaskResponse response =
				taskService.reassessRemainingEffortForCurrentUser(7L, request);

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(45);
		assertThat(task.getEffortVersion()).isEqualTo(3);
		assertThat(response.remainingEffortMinutes()).isEqualTo(45);
		assertThat(response.effortVersion()).isEqualTo(3);

		ArgumentCaptor<RemainingEffortCheckpoint> checkpointCaptor =
				ArgumentCaptor.forClass(RemainingEffortCheckpoint.class);
		verify(remainingEffortCheckpointRepository).save(checkpointCaptor.capture());
		assertThat(checkpointCaptor.getValue().getAssessedRemainingMinutes()).isEqualTo(45);
	}

	@Test
	void reassessRemainingEffortForCurrentUser_explicitUnknown() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");

		Task task = new Task();
		task.setOwner(owner);
		task.setTitle("Unknown remainder");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(2);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
		when(remainingEffortCheckpointRepository.save(any(RemainingEffortCheckpoint.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		RemainingEffortRequest request =
				new RemainingEffortRequest(null, LocalDate.of(2026, 10, 3), 2);

		taskService.reassessRemainingEffortForCurrentUser(7L, request);

		assertThat(task.getRemainingEffortMinutes()).isNull();
		assertThat(task.getEffortVersion()).isEqualTo(3);

		ArgumentCaptor<RemainingEffortCheckpoint> checkpointCaptor =
				ArgumentCaptor.forClass(RemainingEffortCheckpoint.class);
		verify(remainingEffortCheckpointRepository).save(checkpointCaptor.capture());
		assertThat(checkpointCaptor.getValue().getAssessedRemainingMinutes()).isNull();
	}

	@Test
	void reassessRemainingEffortForCurrentUser_staleEffortVersionConflicts() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("Stale reassessment");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(3);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));

		RemainingEffortRequest request =
				new RemainingEffortRequest(45, LocalDate.of(2026, 10, 3), 2);

		assertThatThrownBy(() -> taskService.reassessRemainingEffortForCurrentUser(7L, request))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PROGRESS_CONFLICT"));

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(60);
		assertThat(task.getEffortVersion()).isEqualTo(3);
		verify(taskRepository, never()).save(any(Task.class));
		verify(remainingEffortCheckpointRepository, never()).save(any(RemainingEffortCheckpoint.class));
	}

	@Test
	void deleteForCurrentUser_clearsCheckpointTaskReference() throws Exception {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Task task = new Task();
		task.setTitle("To delete");
		var idField = Task.class.getDeclaredField("id");
		idField.setAccessible(true);
		idField.set(task, 7L);
		when(taskRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(task));

		RemainingEffortCheckpoint checkpoint = new RemainingEffortCheckpoint();
		checkpoint.setSourceTaskId(7L);
		checkpoint.setTaskReference(task);
		when(remainingEffortCheckpointRepository.findByTaskReference_Id(7L))
				.thenReturn(List.of(checkpoint));
		when(remainingEffortCheckpointRepository.save(checkpoint))
				.thenAnswer(invocation -> invocation.getArgument(0));

		taskService.deleteForCurrentUser(7L);

		assertThat(checkpoint.getTaskReference()).isNull();
		assertThat(checkpoint.getSourceTaskId()).isEqualTo(7L);
		verify(remainingEffortCheckpointRepository).save(checkpoint);
		verify(remainingEffortCheckpointRepository, never()).delete(any(RemainingEffortCheckpoint.class));
		verify(taskRepository).delete(task);
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
