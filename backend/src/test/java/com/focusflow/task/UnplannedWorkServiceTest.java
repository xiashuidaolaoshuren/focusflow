package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.NotFoundException;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.dto.UnplannedWorkRequest;
import com.focusflow.task.dto.UnplannedWorkResponse;
import com.focusflow.testsupport.TaskTestBuilder;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.stereotype.Service;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class UnplannedWorkServiceTest {

	private static final Long OWNER_ID = 42L;
	private static final Long TASK_ID = 7L;
	private static final LocalDate WORK_DATE = LocalDate.of(2026, 10, 5);

	@Mock private CurrentUser currentUser;
	@Mock private OwnerSchedulingLock ownerSchedulingLock;
	@Mock private TaskRepository taskRepository;
	@Mock private UnplannedWorkRepository unplannedWorkRepository;
	@Mock private TaskService taskService;

	private UnplannedWorkService service;
	private User owner;
	private Task task;

	@BeforeEach
	void setUp() {
		service =
				new UnplannedWorkService(
						currentUser,
						ownerSchedulingLock,
						taskRepository,
						unplannedWorkRepository,
						taskService);
		owner = new User();
		task =
				TaskTestBuilder.task(owner)
						.withTitle("Write report")
						.withEstimatedMinutes(100)
						.build();
		task.setRemainingEffortMinutes(100);
		task.setEffortVersion(0);
		ReflectionTestUtils.setField(task, "id", TASK_ID);
	}

	@Test
	void unplannedWorkService_isASpringService() {
		assertThat(UnplannedWorkService.class).hasAnnotation(Service.class);
	}

	@Test
	void create_creditsActualMinutesAndMovesOpenTaskToInProgress() {
		stubOwnerAndTask();
		when(unplannedWorkRepository.save(any(UnplannedWork.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		UnplannedWorkResponse response =
				service.create(
						new UnplannedWorkRequest(
								TASK_ID,
								WORK_DATE,
								35,
								WORK_DATE,
								0,
								false,
								null));

		assertThat(response.actualMinutes()).isEqualTo(35);
		assertThat(response.workDate()).isEqualTo(WORK_DATE);
		assertThat(response.sourceTaskId()).isEqualTo(TASK_ID);
		assertThat(response.taskReferenceId()).isEqualTo(TASK_ID);
		assertThat(response.recordedAt()).isNotNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(65);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
		assertThat(task.getEffortVersion()).isEqualTo(1);
		verify(ownerSchedulingLock).lockCurrentOwner();
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void create_whenRemainderIsUnknown_leavesRemainderUnknown() {
		task.setRemainingEffortMinutes(null);
		stubOwnerAndTask();
		when(unplannedWorkRepository.save(any(UnplannedWork.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		service.create(
				new UnplannedWorkRequest(
						TASK_ID, WORK_DATE, 35, WORK_DATE, 0, false, null));

		assertThat(task.getRemainingEffortMinutes()).isNull();
		assertThat(task.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
	}

	@Test
	void create_whenActualMinutesAreNotPositive_throwsBadRequestAndWritesNothing() {
		stubOwnerAndTaskLookup();

		assertThatThrownBy(
						() ->
								service.create(
										new UnplannedWorkRequest(
												TASK_ID, WORK_DATE, 0, WORK_DATE, 0, false, null)))
				.isInstanceOf(BadRequestException.class);

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.OPEN);
		verify(unplannedWorkRepository, never()).save(any(UnplannedWork.class));
		verify(taskRepository, never()).save(task);
	}

	@Test
	void create_whenCurrentDateIsMissing_throwsBadRequestAndWritesNothing() {
		stubOwnerAndTaskLookup();

		assertThatThrownBy(
						() ->
								service.create(
										new UnplannedWorkRequest(
												TASK_ID, WORK_DATE, 35, null, 0, false, null)))
				.isInstanceOf(BadRequestException.class);

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		verify(unplannedWorkRepository, never()).save(any(UnplannedWork.class));
		verify(taskRepository, never()).save(task);
	}

	@Test
	void create_whenWorkDateIsAfterCurrentDate_throwsFutureActualAndWritesNothing() {
		stubOwnerAndTaskLookup();
		LocalDate futureWorkDate = WORK_DATE.plusDays(1);

		assertThatThrownBy(
						() ->
								service.create(
										new UnplannedWorkRequest(
												TASK_ID,
												futureWorkDate,
												35,
												WORK_DATE,
												0,
												false,
												null)))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("FUTURE_ACTUAL"));

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		verify(unplannedWorkRepository, never()).save(any(UnplannedWork.class));
		verify(taskRepository, never()).save(task);
	}

	@Test
	void create_whenRemainderWouldBeExhausted_throwsRemainderUnresolvedAndWritesNothing() {
		task.setRemainingEffortMinutes(20);
		stubOwnerAndTaskLookup();

		assertThatThrownBy(
						() ->
								service.create(
										new UnplannedWorkRequest(
												TASK_ID, WORK_DATE, 30, WORK_DATE, 0, false, null)))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("REMAINDER_UNRESOLVED"));

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(20);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.OPEN);
		verify(unplannedWorkRepository, never()).save(any(UnplannedWork.class));
		verify(taskRepository, never()).save(task);
	}

	@Test
	void create_withCheckpoint_replacesRemainderWithoutCreditingMinutes() {
		stubOwnerAndTask();
		when(unplannedWorkRepository.save(any(UnplannedWork.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		service.create(
				new UnplannedWorkRequest(
						TASK_ID,
						WORK_DATE,
						35,
						WORK_DATE,
						0,
						false,
						new UnplannedWorkRequest.Checkpoint(90)));

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(90);
		verify(taskService).recordRemainingEffortCheckpoint(task, WORK_DATE, 90);
	}

	@Test
	void create_withFinish_setsDoneAndZeroRemainder() {
		task.setRemainingEffortMinutes(20);
		stubOwnerAndTask();
		when(unplannedWorkRepository.save(any(UnplannedWork.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		service.create(
				new UnplannedWorkRequest(
						TASK_ID, WORK_DATE, 30, WORK_DATE, 0, true, null));

		assertThat(task.getRemainingEffortMinutes()).isZero();
		assertThat(task.getStatus()).isEqualTo(TaskStatus.DONE);
		verify(taskService).recordRemainingEffortCheckpoint(task, WORK_DATE, 0);
	}

	@Test
	void create_withStaleEffortVersion_throwsProgressConflictAndWritesNothing() {
		task.setEffortVersion(1);
		stubOwnerAndTaskLookup();

		assertThatThrownBy(
						() ->
								service.create(
										new UnplannedWorkRequest(
												TASK_ID, WORK_DATE, 35, WORK_DATE, 0, false, null)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PROGRESS_CONFLICT"));

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		assertThat(task.getStatus()).isEqualTo(TaskStatus.OPEN);
		verify(unplannedWorkRepository, never()).save(any(UnplannedWork.class));
		verify(taskRepository, never()).save(task);
	}

	@Test
	void correct_adjustsRemainderByTheMinuteDelta() {
		UnplannedWork entry = savedEntry(35);
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerTaskAndEntry(entry);

		service.correct(
				entry.getId(),
				new UnplannedWorkRequest(
						TASK_ID, WORK_DATE, 50, WORK_DATE, 1, false, null));

		assertThat(entry.getActualMinutes()).isEqualTo(50);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(50);
		assertThat(task.getEffortVersion()).isEqualTo(2);
	}

	@Test
	void correct_keepsRecordedAtAndWorkDate() {
		UnplannedWork entry = savedEntry(35);
		Instant recordedAt = entry.getRecordedAt();
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerTaskAndEntry(entry);

		service.correct(
				entry.getId(),
				new UnplannedWorkRequest(
						TASK_ID, WORK_DATE, 40, WORK_DATE, 1, false, null));

		assertThat(entry.getRecordedAt()).isEqualTo(recordedAt);
		assertThat(entry.getWorkDate()).isEqualTo(WORK_DATE);
	}

	@Test
	void correct_whenWorkDateDiffers_throwsBadRequestAndWritesNothing() {
		UnplannedWork entry = savedEntry(35);
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerAndTaskLookup();
		when(unplannedWorkRepository.findByOwner_IdAndId(OWNER_ID, entry.getId()))
				.thenReturn(Optional.of(entry));

		assertThatThrownBy(
						() ->
								service.correct(
										entry.getId(),
										new UnplannedWorkRequest(
												TASK_ID,
												WORK_DATE.plusDays(1),
												40,
												WORK_DATE,
												1,
												false,
												null)))
				.isInstanceOf(BadRequestException.class);

		assertThat(entry.getActualMinutes()).isEqualTo(35);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(65);
	}

	@Test
	void correct_afterALaterCheckpoint_updatesHistoryOnly() {
		UnplannedWork entry = savedEntry(35);
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerTaskAndEntry(entry);
		when(taskService.latestCheckpointRecordedAt(task))
				.thenReturn(entry.getRecordedAt().plusSeconds(60));

		service.correct(
				entry.getId(),
				new UnplannedWorkRequest(
						TASK_ID, WORK_DATE, 50, WORK_DATE, 1, false, null));

		assertThat(entry.getActualMinutes()).isEqualTo(50);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(65);
		assertThat(task.getEffortVersion()).isEqualTo(1);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void delete_reversesCreditedMinutesWhenUnshielded() {
		UnplannedWork entry = savedEntry(35);
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerTaskAndEntryLookup(entry);
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));

		service.delete(entry.getId(), 1);

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		assertThat(task.getEffortVersion()).isEqualTo(2);
		verify(unplannedWorkRepository).delete(entry);
		verify(taskRepository).save(task);
	}

	@Test
	void delete_whenShieldedByLaterCheckpoint_removesRowAndLeavesRemainder() {
		UnplannedWork entry = savedEntry(35);
		task.setRemainingEffortMinutes(65);
		task.setEffortVersion(1);
		stubOwnerTaskAndEntryLookup(entry);
		when(taskService.latestCheckpointRecordedAt(task))
				.thenReturn(entry.getRecordedAt().plusSeconds(60));

		service.delete(entry.getId(), 1);

		assertThat(task.getRemainingEffortMinutes()).isEqualTo(65);
		assertThat(task.getEffortVersion()).isEqualTo(1);
		verify(unplannedWorkRepository).delete(entry);
		verify(taskRepository, never()).save(task);
	}

	@Test
	void delete_whenNotOwned_throwsNotFound() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(OWNER_ID, "owner@example.com", "owner"));
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(unplannedWorkRepository.findByOwner_IdAndId(OWNER_ID, 99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> service.delete(99L, 0))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("unplanned work not found");

		verify(unplannedWorkRepository, never()).delete(any(UnplannedWork.class));
	}

	private UnplannedWork savedEntry(int actualMinutes) {
		UnplannedWork entry = new UnplannedWork();
		entry.setOwner(owner);
		entry.setSourceTaskId(TASK_ID);
		entry.setTaskReference(task);
		entry.setWorkDate(WORK_DATE);
		entry.setActualMinutes(actualMinutes);
		entry.setRecordedAt(Instant.parse("2026-10-05T10:00:00Z"));
		ReflectionTestUtils.setField(entry, "id", 99L);
		return entry;
	}

	private void stubOwnerTaskAndEntry(UnplannedWork entry) {
		stubOwnerTaskAndEntryLookup(entry);
		when(unplannedWorkRepository.save(entry))
				.thenAnswer(invocation -> invocation.getArgument(0));
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
	}

	private void stubOwnerTaskAndEntryLookup(UnplannedWork entry) {
		stubOwnerAndTaskLookup();
		when(unplannedWorkRepository.findByOwner_IdAndId(OWNER_ID, entry.getId()))
				.thenReturn(Optional.of(entry));
	}

	private void stubOwnerAndTask() {
		stubOwnerAndTaskLookup();
		when(taskRepository.save(task)).thenAnswer(invocation -> invocation.getArgument(0));
	}

	private void stubOwnerAndTaskLookup() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(OWNER_ID, "owner@example.com", "owner"));
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, TASK_ID)).thenReturn(Optional.of(task));
	}
}
