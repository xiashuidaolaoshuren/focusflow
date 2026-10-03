package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.effort.WorkOutcome;
import com.focusflow.plan.dto.BlockProgressRequest;
import com.focusflow.plan.dto.BlockProgressResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.Task;
import com.focusflow.task.TaskResponseMapper;
import com.focusflow.task.TaskService;
import com.focusflow.task.TaskStatus;
import com.focusflow.testsupport.DailyPlanTestBuilder;
import com.focusflow.testsupport.TaskTestBuilder;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.stereotype.Service;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class BlockProgressServiceTest {

	private static final Long OWNER_ID = 42L;
	private static final Long PLAN_ID = 7L;
	private static final Long BLOCK_ID = 11L;
	private static final LocalDate PLAN_DATE = LocalDate.of(2026, 10, 5);

	@Mock private CurrentUser currentUser;
	@Mock private DailyPlanRepository dailyPlanRepository;
	@Mock private OwnerSchedulingLock ownerSchedulingLock;
	@Mock private TaskService taskService;

	private final TaskResponseMapper taskResponseMapper = new TaskResponseMapper();
	private final DailyPlanResponseMapper dailyPlanResponseMapper = new DailyPlanResponseMapper();

	private BlockProgressService service;
	private User owner;
	private Task task;
	private DailyPlanBlock block;

	@BeforeEach
	void setUp() {
		service =
				new BlockProgressService(
						currentUser,
						dailyPlanRepository,
						ownerSchedulingLock,
						taskService,
						taskResponseMapper,
						dailyPlanResponseMapper);
		owner = new User();
		task =
				TaskTestBuilder.task(owner)
						.withTitle("Write report")
						.withEstimatedMinutes(100)
						.build();
		task.setRemainingEffortMinutes(100);
	}

	/**
	 * Scaffold gate for the new module: the service type must exist and be a Spring service so the
	 * plan feature can inject it. Behavior is added by the following RED/GREEN pairs.
	 */
	@Test
	void blockProgressService_isASpringService() {
		assertThat(BlockProgressService.class).hasAnnotation(Service.class);
	}

	@Test
	void record_doneCreditsPlannedDurationAndLeavesActualUnknown() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
		assertThat(response.task().status()).isEqualTo(TaskStatus.IN_PROGRESS);
		assertThat(block.getOutcome()).isEqualTo("DONE");
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.getRecordedAt()).isNotNull();
	}

	@Test
	void record_doneWithUnknownRemainderLeavesRemainderUnknown() {
		task.setRemainingEffortMinutes(null);
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isNull();
		assertThat(block.getOutcome()).isEqualTo("DONE");
	}

	@Test
	void record_partlyDoneCreditsActualMinutes() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, 35, PLAN_DATE, 0, false, null);

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(65);
		assertThat(response.task().status()).isEqualTo(TaskStatus.IN_PROGRESS);
		assertThat(block.getOutcome()).isEqualTo("PARTLY_DONE");
		assertThat(block.getActualMinutes()).isEqualTo(35);
	}

	@Test
	void record_partlyDoneWhenActualMinutesMissing_throwsBadRequest() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, null, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class);
		assertThat(block.getOutcome()).isNull();
		assertThat(block.getActualMinutes()).isNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
	}

	@Test
	void record_partlyDoneWhenActualMinutesNotPositive_throwsBadRequest() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, 0, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class);
		assertThat(block.getOutcome()).isNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
	}

	@Test
	void record_skippedCreditsNothingAndLeavesTaskOpen() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.SKIPPED, null, PLAN_DATE, 0, false, null);

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(100);
		assertThat(response.task().status()).isEqualTo(TaskStatus.OPEN);
		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
		assertThat(block.getActualMinutes()).isNull();
	}

	@Test
	void record_whenPlanDateIsAfterCurrentDate_throwsFutureActual() {
		stubOwnerAndPlan(
				planWithWorkBlock(PLAN_DATE.plusDays(1), LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("FUTURE_ACTUAL"));
		assertThat(block.getOutcome()).isNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
	}

	@Test
	void record_whenCurrentDateIsMissing_throwsBadRequest() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, null, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class);
		assertThat(block.getOutcome()).isNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
	}

	@Test
	void record_whenBlockIsNotWork_throwsBlockNotRecordable() {
		DailyPlan plan =
				DailyPlanTestBuilder.plan(owner, PLAN_DATE)
						.addTask(task, 1, true, null, null)
						.addBlock(0, BlockKind.CADENCE_BREAK, LocalTime.of(9, 50), LocalTime.of(10, 0), "Break", 1)
						.build();
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		block = plan.getLatestRevision().getBlocks().iterator().next();
		ReflectionTestUtils.setField(block, "id", BLOCK_ID);
		stubOwnerAndPlan(plan);
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("BLOCK_NOT_RECORDABLE"));
		assertThat(block.getOutcome()).isNull();
	}

	@Test
	void record_whenTaskIsFinished_throwsBlockNotRecordable() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		task.setStatus(TaskStatus.DONE);
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("BLOCK_NOT_RECORDABLE"));
		assertThat(block.getOutcome()).isNull();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
	}

	@Test
	void record_supersededBlockIsRejectedWhileEndedEarlierBlockStaysRecordable() {
		DailyPlan plan =
				DailyPlanTestBuilder.plan(owner, PLAN_DATE)
						.addTask(task, 1, true, null, null)
						.buildTasksOnly();
		DailyPlanRevision firstRevision = plan.getLatestRevision();
		DailyPlanTask planTask = firstRevision.getTasks().iterator().next();
		DailyPlanBlock superseded = workBlock(planTask, LocalTime.of(10, 30), LocalTime.of(11, 20), 21L);
		DailyPlanBlock alreadyEnded = workBlock(planTask, LocalTime.of(8, 0), LocalTime.of(8, 50), 22L);
		firstRevision.addBlock(superseded);
		firstRevision.addBlock(alreadyEnded);
		DailyPlanRevision latestRevision = new DailyPlanRevision();
		latestRevision.setRevisionNumber(2);
		latestRevision.setCutoffTime(LocalTime.of(10, 0));
		plan.addRevision(latestRevision);
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		stubOwnerAndPlan(plan);
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, 21L, request))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("BLOCK_NOT_RECORDABLE"));
		assertThat(superseded.getOutcome()).isNull();

		BlockProgressResponse response = service.record(PLAN_ID, 22L, request);

		assertThat(alreadyEnded.getOutcome()).isEqualTo("DONE");
		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
	}

	private DailyPlanBlock workBlock(
			DailyPlanTask planTask, LocalTime start, LocalTime end, long blockId) {
		DailyPlanBlock workBlock = new DailyPlanBlock();
		workBlock.setKind(BlockKind.WORK);
		workBlock.setStartTime(start);
		workBlock.setEndTime(end);
		workBlock.setPosition(0);
		workBlock.setDailyPlanTask(planTask);
		ReflectionTestUtils.setField(workBlock, "id", blockId);
		return workBlock;
	}

	@Test
	void record_partlyDoneExhaustingRemainder_throwsRemainderUnresolvedAndWritesNothing() {
		task.setRemainingEffortMinutes(20);
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, 30, PLAN_DATE, 0, false, null);

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("REMAINDER_UNRESOLVED"));
		assertThat(block.getOutcome()).isNull();
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.getProgressVersion()).isZero();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(20);
		assertThat(task.getEffortVersion()).isZero();
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_exhaustingSaveWithFinish_savesOutcomeAndZeroRemainder() {
		task.setRemainingEffortMinutes(20);
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, 30, PLAN_DATE, 0, true, null);

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().status()).isEqualTo(TaskStatus.DONE);
		assertThat(response.task().remainingEffortMinutes()).isZero();
		assertThat(block.getOutcome()).isEqualTo("PARTLY_DONE");
		assertThat(block.getActualMinutes()).isEqualTo(30);
		verify(taskService).recordRemainingEffortCheckpoint(task, PLAN_DATE, 0);
	}

	@Test
	void record_exhaustingSaveWithPositiveCheckpoint_savesOutcomeAndAssessedRemainder() {
		task.setRemainingEffortMinutes(20);
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(
						WorkOutcome.PARTLY_DONE,
						30,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(90));

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(90);
		assertThat(response.task().status()).isEqualTo(TaskStatus.IN_PROGRESS);
		assertThat(block.getOutcome()).isEqualTo("PARTLY_DONE");
		verify(taskService).recordRemainingEffortCheckpoint(task, PLAN_DATE, 90);
	}

	@Test
	void record_correctingRecordedOutcomeAdjustsRemainderByTheCreditDelta() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));
		Instant firstRecordedAt = block.getRecordedAt();

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.SKIPPED,
								null,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(100);
		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.getProgressVersion()).isEqualTo(2);
		assertThat(block.getRecordedAt()).isEqualTo(firstRecordedAt);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_correctingPartlyDoneToDoneCreditsPlannedDurationInsteadOfActual() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.PARTLY_DONE, 30, PLAN_DATE, 0, false, null));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.DONE,
								40,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
		assertThat(block.getOutcome()).isEqualTo("DONE");
		assertThat(block.getActualMinutes()).isEqualTo(40);
	}

	@Test
	void record_correctingOnlyActualMinutesOfDoneBlockLeavesRemainderUnchanged() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, 35, PLAN_DATE, 0, false, null));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.DONE,
								60,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
		assertThat(block.getActualMinutes()).isEqualTo(60);
	}

	@Test
	void record_correctionThatWouldExhaustTheRemainder_throwsRemainderUnresolvedAndWritesNothing() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));
		int recordedVersion = block.getProgressVersion();
		Instant recordedAt = block.getRecordedAt();

		assertThatThrownBy(
						() ->
								service.record(
										PLAN_ID,
										BLOCK_ID,
										new BlockProgressRequest(
												WorkOutcome.PARTLY_DONE,
												120,
												PLAN_DATE,
												recordedVersion,
												false,
												null)))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("REMAINDER_UNRESOLVED"));

		assertThat(block.getOutcome()).isEqualTo("DONE");
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.getProgressVersion()).isEqualTo(recordedVersion);
		assertThat(block.getRecordedAt()).isEqualTo(recordedAt);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(50);
	}

	@Test
	void record_correctingWhenRemainderIsUnknown_keepsRemainderUnknown() {
		task.setRemainingEffortMinutes(null);
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.SKIPPED,
								null,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isNull();
		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
	}

	@Test
	void record_expectedProgressVersionGate_rejectsStaleAndSkipsWhenOmitted() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));

		assertThatThrownBy(
						() ->
								service.record(
										PLAN_ID,
										BLOCK_ID,
										new BlockProgressRequest(
												WorkOutcome.DONE, null, PLAN_DATE, 3, false, null)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PROGRESS_CONFLICT"));
		assertThat(block.getOutcome()).isNull();
		assertThat(block.getProgressVersion()).isZero();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		assertThat(task.getEffortVersion()).isZero();
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, null, false, null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
		assertThat(block.getOutcome()).isEqualTo("DONE");
		assertThat(block.getProgressVersion()).isEqualTo(1);
	}

	@Test
	void record_correctionWithStaleExpectedProgressVersion_returnsConflictAndWritesNothing() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));

		assertThatThrownBy(
						() ->
								service.record(
										PLAN_ID,
										BLOCK_ID,
										new BlockProgressRequest(
												WorkOutcome.SKIPPED, null, PLAN_DATE, 0, false, null)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PROGRESS_CONFLICT"));

		assertThat(block.getOutcome()).isEqualTo("DONE");
		assertThat(block.getProgressVersion()).isEqualTo(1);
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(50);
		assertThat(task.getEffortVersion()).isEqualTo(1);
	}

	@Test
	void record_correctionAfterALaterCheckpoint_updatesHistoryOnly() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));
		when(taskService.latestCheckpointRecordedAt(task))
				.thenReturn(block.getRecordedAt().plusSeconds(60));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.SKIPPED,
								null,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(50);
		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.getProgressVersion()).isEqualTo(2);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_correctionAfterAnEarlierCheckpoint_stillAdjustsTheRemainder() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));
		when(taskService.latestCheckpointRecordedAt(task))
				.thenReturn(block.getRecordedAt().minusSeconds(60));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.SKIPPED,
								null,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(100);
		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
	}

	@Test
	void record_correctionOnFinishedTask_keepsZeroRemainderAndDoneStatus() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(WorkOutcome.DONE, null, PLAN_DATE, 0, false, null));
		task.setStatus(TaskStatus.DONE);
		task.setRemainingEffortMinutes(0);
		when(taskService.latestCheckpointRecordedAt(task))
				.thenReturn(block.getRecordedAt().plusSeconds(60));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.PARTLY_DONE,
								20,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								null));

		assertThat(response.task().status()).isEqualTo(TaskStatus.DONE);
		assertThat(response.task().remainingEffortMinutes()).isZero();
		assertThat(block.getOutcome()).isEqualTo("PARTLY_DONE");
		assertThat(block.getActualMinutes()).isEqualTo(20);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_crossingBlockWithCutoff_storesActualMinutesAndCheckpointWithoutPlannedCredit() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(
						WorkOutcome.PARTLY_DONE,
						20,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(70),
						LocalTime.of(9, 20));

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(70);
		assertThat(block.getOutcome()).isEqualTo("PARTLY_DONE");
		assertThat(block.getActualMinutes()).isEqualTo(20);
		assertThat(block.isReconciled()).isTrue();
		assertThat(block.getProgressVersion()).isEqualTo(1);
		assertThat(block.getRecordedAt()).isNotNull();
		verify(taskService).recordRemainingEffortCheckpoint(task, PLAN_DATE, 70);
	}

	@Test
	void record_crossingBlockWithZeroActualMinutes_storesTheKnownZeroAndExplicitUnknown() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(
						WorkOutcome.SKIPPED,
						0,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(null),
						LocalTime.of(9, 20));

		BlockProgressResponse response = service.record(PLAN_ID, BLOCK_ID, request);

		assertThat(response.task().remainingEffortMinutes()).isNull();
		assertThat(response.task().status()).isEqualTo(TaskStatus.OPEN);
		assertThat(block.getActualMinutes()).isZero();
		assertThat(block.isReconciled()).isTrue();
		verify(taskService).recordRemainingEffortCheckpoint(task, PLAN_DATE, null);
	}

	@Test
	void record_crossingBlockWithoutActualMinutes_rejectsAndWritesNothing() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(
						WorkOutcome.SKIPPED,
						null,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(70),
						LocalTime.of(9, 20));

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class);
		assertThat(block.getOutcome()).isNull();
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.isReconciled()).isFalse();
		assertThat(block.getProgressVersion()).isZero();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_crossingBlockWithoutCheckpoint_rejectsAndWritesNothing() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		BlockProgressRequest request =
				new BlockProgressRequest(
						WorkOutcome.SKIPPED,
						0,
						PLAN_DATE,
						0,
						false,
						null,
						LocalTime.of(9, 20));

		assertThatThrownBy(() -> service.record(PLAN_ID, BLOCK_ID, request))
				.isInstanceOf(BadRequestException.class);
		assertThat(block.getOutcome()).isNull();
		assertThat(block.getActualMinutes()).isNull();
		assertThat(block.isReconciled()).isFalse();
		assertThat(block.getProgressVersion()).isZero();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(100);
		verify(taskService, never()).recordRemainingEffortCheckpoint(any(), any(), any());
	}

	@Test
	void record_plainOutcomeOnReconciledBlock_throwsBlockNotRecordable() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(
						WorkOutcome.SKIPPED,
						20,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(70),
						LocalTime.of(9, 20)));

		assertThatThrownBy(
						() ->
								service.record(
										PLAN_ID,
										BLOCK_ID,
										new BlockProgressRequest(
												WorkOutcome.DONE,
												null,
												PLAN_DATE,
												block.getProgressVersion(),
												false,
												null,
												null)))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("BLOCK_NOT_RECORDABLE"));

		assertThat(block.getOutcome()).isEqualTo("SKIPPED");
		assertThat(block.isReconciled()).isTrue();
		assertThat(task.getRemainingEffortMinutes()).isEqualTo(70);
	}

	@Test
	void record_reconcilingAnAlreadyReconciledBlock_replacesTheStoredAssessment() {
		stubOwnerAndPlan(planWithWorkBlock(LocalTime.of(9, 0), LocalTime.of(9, 50)));
		service.record(
				PLAN_ID,
				BLOCK_ID,
				new BlockProgressRequest(
						WorkOutcome.SKIPPED,
						0,
						PLAN_DATE,
						0,
						false,
						new BlockProgressRequest.Checkpoint(70),
						LocalTime.of(9, 20)));

		BlockProgressResponse response =
				service.record(
						PLAN_ID,
						BLOCK_ID,
						new BlockProgressRequest(
								WorkOutcome.PARTLY_DONE,
								5,
								PLAN_DATE,
								block.getProgressVersion(),
								false,
								new BlockProgressRequest.Checkpoint(40),
								LocalTime.of(9, 30)));

		assertThat(response.task().remainingEffortMinutes()).isEqualTo(40);
		assertThat(block.getActualMinutes()).isEqualTo(5);
		assertThat(block.isReconciled()).isTrue();
		assertThat(block.getProgressVersion()).isEqualTo(2);
		verify(taskService).recordRemainingEffortCheckpoint(task, PLAN_DATE, 40);
	}

	private void stubOwnerAndPlan(DailyPlan plan) {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(OWNER_ID, "owner@example.com", "owner"));
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findByOwner_IdAndId(OWNER_ID, PLAN_ID))
				.thenReturn(Optional.of(plan));
	}

	private DailyPlan planWithWorkBlock(LocalTime start, LocalTime end) {
		return planWithWorkBlock(PLAN_DATE, start, end);
	}

	private DailyPlan planWithWorkBlock(LocalDate planDate, LocalTime start, LocalTime end) {
		DailyPlan plan =
				DailyPlanTestBuilder.plan(owner, planDate)
						.addTask(task, 1, true, null, null)
						.addBlock(0, BlockKind.WORK, start, end, null, 0)
						.build();
		ReflectionTestUtils.setField(plan, "id", PLAN_ID);
		block = plan.getLatestRevision().getBlocks().iterator().next();
		ReflectionTestUtils.setField(block, "id", BLOCK_ID);
		return plan;
	}
}
