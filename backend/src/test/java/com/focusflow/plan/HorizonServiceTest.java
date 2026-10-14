package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.horizon.HorizonForecast;
import com.focusflow.horizon.HorizonForecast.CreditExclusion;
import com.focusflow.horizon.HorizonForecast.DayKind;
import com.focusflow.plan.dto.HorizonResponse;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskService;
import com.focusflow.task.TaskStatus;
import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class HorizonServiceTest {

	private static final LocalDate MONDAY = LocalDate.of(2026, 6, 1);
	private static final Long OWNER_ID = 42L;

	@Mock private CurrentUser currentUser;
	@Mock private TaskQueryService taskQueryService;
	@Mock private TaskService taskService;
	@Mock private CommitmentQueryService commitmentQueryService;
	@Mock private SchedulingPreferencesQueryService schedulingPreferencesQueryService;
	@Mock private DailyPlanRepository dailyPlanRepository;

	private HorizonService horizonService;

	@BeforeEach
	void setUp() {
		horizonService =
				new HorizonService(
						currentUser,
						taskQueryService,
						taskService,
						commitmentQueryService,
						schedulingPreferencesQueryService,
						dailyPlanRepository);
		lenient()
				.when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(OWNER_ID, "owner@test", "owner"));
		lenient()
				.when(schedulingPreferencesQueryService.effectiveFor(OWNER_ID))
				.thenReturn(defaultPreferences());
		lenient().when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of());
		lenient().when(taskQueryService.findLinksByOwnerId(OWNER_ID)).thenReturn(List.of());
		lenient()
				.when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(any(), any(), any()))
				.thenReturn(List.of());
		lenient()
				.when(commitmentQueryService.windowsFor(eq(OWNER_ID), any()))
				.thenReturn(List.of());
	}

	@Test
	void read_emptyOwner_returnsAssumptionsSevenForecastColumnsAndNoTasks() {
		HorizonResponse response =
				horizonService.read(MONDAY, LocalTime.of(9, 0));

		assertThat(response.assumptions().pace()).isEqualTo("AS_PLANNED");
		assertThat(response.assumptions().workingDays())
				.containsExactlyElementsOf(SchedulingPreferenceDefaults.WORKING_DAYS);
		assertThat(response.assumptions().horizonWorkingDays()).isEqualTo(7);
		assertThat(response.days()).hasSize(7);
		assertThat(response.days()).allMatch(day -> day.kind() == DayKind.FORECAST);
		assertThat(response.tasks()).isEmpty();
	}

	@Test
	void read_missingCurrentDate_throwsBadRequest() {
		assertThatThrownBy(() -> horizonService.read(null, LocalTime.of(9, 0)))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("currentDate is required");
	}

	@Test
	void read_missingCurrentTime_throwsBadRequest() {
		assertThatThrownBy(() -> horizonService.read(MONDAY, null))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("currentTime is required");
	}

	@Test
	void read_unalignedCurrentTime_throwsBadRequest() {
		assertThatThrownBy(() -> horizonService.read(MONDAY, LocalTime.of(9, 0, 30)))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("times must be minute-aligned");
	}

	@Test
	void read_isReadOnlyRepeatableReadTransactional() throws Exception {
		Method method = HorizonService.class.getMethod("read", LocalDate.class, LocalTime.class);
		Transactional transactional = method.getAnnotation(Transactional.class);

		assertThat(transactional).isNotNull();
		assertThat(transactional.readOnly()).isTrue();
		assertThat(transactional.isolation()).isEqualTo(Isolation.REPEATABLE_READ);
	}

	@Test
	void read_savedPlanInRange_becomesSavedColumnWithLatestPlanAndNeedsRefresh() {
		DailyPlan older = planOnDate(MONDAY, 10L, Instant.parse("2026-06-01T08:00:00Z"));
		DailyPlan newer = planOnDate(MONDAY, 20L, Instant.parse("2026-06-01T09:00:00Z"));
		DailyPlanTask staleTask =
				planTask(
						newer.getLatestRevision(),
						1,
						10L,
						10L,
						"Stale",
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						60);
		staleTask.setCapturedRemainingEffortMinutes(60);
		staleTask.getTaskReference().setRemainingEffortMinutes(30);
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(older, newer));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.DayResponse monday =
				response.days().stream()
						.filter(day -> day.date().equals(MONDAY))
						.findFirst()
						.orElseThrow();
		assertThat(monday.kind()).isEqualTo(DayKind.SAVED);
		assertThat(monday.planId()).isEqualTo(20L);
		assertThat(monday.needsRefresh()).isTrue();
	}

	@Test
	void read_todayPlan_usesComposedRailMinutesAcrossRevisions() {
		DailyPlan plan = scheduledPlan(MONDAY, 1L);
		DailyPlanRevision first = plan.getLatestRevision();
		DailyPlanTask elapsedTask =
				planTask(first, 1, 10L, 10L, "Elapsed", TaskPriority.HIGH, TaskStatus.OPEN, null, 60);
		DailyPlanBlock elapsedDone =
				planBlock(first, elapsedTask, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), 1);
		elapsedDone.setOutcome("DONE");

		DailyPlanRevision second = new DailyPlanRevision();
		second.setRevisionNumber(2);
		second.setCutoffTime(LocalTime.of(14, 0));
		second.setFreeMinutes(300);
		second.setScheduledWorkMinutes(60);
		second.setRequiredMinutes(60L);
		second.setCreatedAt(Instant.parse("2026-06-01T10:00:00Z"));
		plan.addRevision(second);
		DailyPlanTask forwardTask =
				planTask(second, 1, 10L, 10L, "Forward", TaskPriority.HIGH, TaskStatus.OPEN, null, 60);
		planBlock(second, forwardTask, BlockKind.WORK, LocalTime.of(14, 0), LocalTime.of(15, 0), 1);

		Task live = forwardTask.getTaskReference();
		when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of(live));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(plan));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.TaskRowResponse row =
				response.tasks().stream().filter(task -> task.taskId() == 10L).findFirst().orElseThrow();
		assertThat(row.segments()).hasSize(1);
		assertThat(row.segments().getFirst().date()).isEqualTo(MONDAY);
		assertThat(row.segments().getFirst().minutes()).isEqualTo(120);
	}

	@Test
	void read_todayPlan_unplacedComesFromLatestRevisionOnly() {
		DailyPlan plan = scheduledPlan(MONDAY, 1L);
		DailyPlanRevision first = plan.getLatestRevision();
		planTask(
				first,
				1,
				10L,
				10L,
				"Old unplaced",
				TaskPriority.MEDIUM,
				TaskStatus.OPEN,
				null,
				30,
				UnplacedReason.OUT_OF_TIME,
				99);

		DailyPlanRevision second = new DailyPlanRevision();
		second.setRevisionNumber(2);
		second.setCutoffTime(LocalTime.of(12, 0));
		second.setFreeMinutes(300);
		second.setScheduledWorkMinutes(0);
		second.setRequiredMinutes(0L);
		second.setCreatedAt(Instant.parse("2026-06-01T10:00:00Z"));
		plan.addRevision(second);
		planTask(
				second,
				1,
				10L,
				10L,
				"Latest unplaced",
				TaskPriority.MEDIUM,
				TaskStatus.OPEN,
				null,
				30,
				UnplacedReason.OUT_OF_TIME,
				15);

		Task live = second.getTasks().iterator().next().getTaskReference();
		when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of(live));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(plan));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.TaskRowResponse row =
				response.tasks().stream().filter(task -> task.taskId() == 10L).findFirst().orElseThrow();
		assertThat(row.segments())
				.anySatisfy(
						segment -> {
							assertThat(segment.unplacedMinutes()).isEqualTo(15);
							assertThat(segment.unplacedReason()).isEqualTo(UnplacedReason.OUT_OF_TIME);
						});
	}

	@Test
	void read_otherSavedDate_usesLatestRevisionSessionsWithFlagsAndCheckpoint() {
		LocalDate tuesday = LocalDate.of(2026, 6, 2);
		DailyPlan plan = scheduledPlan(tuesday, 2L);
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask task =
				planTask(revision, 1, 10L, 10L, "Saved", TaskPriority.MEDIUM, TaskStatus.OPEN, null, 60);
		task.setCapturedCheckpointId(77L);
		DailyPlanBlock block =
				planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), 1);
		block.setOutcome("PARTLY_DONE");
		block.setReconciled(true);

		when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of(task.getTaskReference()));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(plan));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.TaskRowResponse row =
				response.tasks().stream().filter(r -> r.taskId() == 10L).findFirst().orElseThrow();
		HorizonResponse.SegmentResponse tuesdaySegment =
				row.segments().stream()
						.filter(segment -> segment.date().equals(tuesday))
						.findFirst()
						.orElseThrow();
		assertThat(tuesdaySegment.minutes()).isEqualTo(60);
	}

	@Test
	void read_checkpointOnSavedSession_appliesCheckpointExclusion() {
		DailyPlan plan = scheduledPlan(MONDAY, 1L);
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask task =
				planTask(revision, 1, 10L, 10L, "Work", TaskPriority.MEDIUM, TaskStatus.OPEN, null, 80);
		task.setCapturedCheckpointId(4L);
		planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), 1);
		DailyPlanTask taskCopy =
				planTask(revision, 2, 10L, 10L, "Work", TaskPriority.MEDIUM, TaskStatus.OPEN, null, 80);
		taskCopy.setCapturedCheckpointId(5L);
		planBlock(revision, taskCopy, BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(10, 30), 2);

		Task live = task.getTaskReference();
		when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of(live));
		when(taskService.latestCheckpointId(live)).thenReturn(Optional.of(5L));
		when(taskService.latestCheckpointOrder(live))
				.thenReturn(Optional.of(new com.focusflow.task.CheckpointOrder(MONDAY, Instant.now())));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(plan));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.TaskRowResponse row =
				response.tasks().stream().filter(r -> r.taskId() == 10L).findFirst().orElseThrow();
		HorizonResponse.SegmentResponse monday =
				row.segments().stream()
						.filter(segment -> segment.date().equals(MONDAY))
						.findFirst()
						.orElseThrow();
		assertThat(monday.creditExclusions()).contains(CreditExclusion.CHECKPOINT);
		assertThat(monday.assumedCreditMinutes()).isEqualTo(30);
	}

	@Test
	void read_loadsCommitmentsOnlyForWorkingNonSavedForecastDates() {
		DailyPlan savedMonday = planOnDate(MONDAY, 1L, Instant.parse("2026-06-01T08:00:00Z"));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(savedMonday));

		horizonService.read(MONDAY, LocalTime.of(9, 0));

		verify(commitmentQueryService, never()).windowsFor(OWNER_ID, MONDAY);
		verify(commitmentQueryService).windowsFor(OWNER_ID, LocalDate.of(2026, 6, 2));
		verify(commitmentQueryService).windowsFor(OWNER_ID, LocalDate.of(2026, 6, 3));
	}

	@Test
	void read_savedOnlyTask_prefersLiveRowAndNullDeadlineForDeletedSnapshot() {
		LocalDate tuesday = LocalDate.of(2026, 6, 2);
		DailyPlan plan = scheduledPlan(tuesday, 1L);
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask deletedSnapshot =
				planTask(
						revision,
						1,
						99L,
						null,
						"Deleted",
						TaskPriority.LOW,
						TaskStatus.OPEN,
						MONDAY,
						30);
		planBlock(revision, deletedSnapshot, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 30), 1);

		Task doneLive = new Task();
		ReflectionTestUtils.setField(doneLive, "id", 88L);
		doneLive.setTitle("Done live");
		doneLive.setStatus(TaskStatus.DONE);
		doneLive.setPriority(TaskPriority.MEDIUM);
		doneLive.setDueDate(MONDAY);
		doneLive.setRemainingEffortMinutes(0);
		DailyPlanTask doneSnapshot =
				planTask(
						revision,
						2,
						88L,
						88L,
						"Done snapshot",
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						MONDAY,
						30);
		planBlock(revision, doneSnapshot, BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(10, 30), 2);

		when(taskQueryService.findPlannableTasksByOwnerId(OWNER_ID)).thenReturn(List.of());
		when(taskQueryService.findOwnedTasksByIds(OWNER_ID, Set.of(88L, 99L))).thenReturn(List.of(doneLive));
		when(dailyPlanRepository.findByOwner_IdAndPlanDateBetween(OWNER_ID, MONDAY, LocalDate.of(2026, 6, 9)))
				.thenReturn(List.of(plan));

		HorizonResponse response = horizonService.read(MONDAY, LocalTime.of(9, 0));

		HorizonResponse.TaskRowResponse deletedRow =
				response.tasks().stream().filter(row -> row.taskId() == 99L).findFirst().orElseThrow();
		assertThat(deletedRow.title()).isEqualTo("Deleted");
		assertThat(deletedRow.deadlineStatus()).isNull();

		HorizonResponse.TaskRowResponse doneRow =
				response.tasks().stream().filter(row -> row.taskId() == 88L).findFirst().orElseThrow();
		assertThat(doneRow.status()).isEqualTo(TaskStatus.DONE);
		assertThat(doneRow.deadlineStatus()).isNull();
	}

	private static EffectiveSchedulingPreferences defaultPreferences() {
		return new EffectiveSchedulingPreferences(
				SchedulingPreferenceDefaults.WORK_DAY_START,
				SchedulingPreferenceDefaults.WORK_DAY_END,
				SchedulingPreferenceDefaults.CADENCE_ENABLED,
				SchedulingPreferenceDefaults.TARGET_FOCUS_MINUTES,
				SchedulingPreferenceDefaults.BREAK_MINUTES,
				SchedulingPreferenceDefaults.MIN_SESSION_MINUTES,
				SchedulingPreferenceDefaults.BUFFER_MINUTES,
				null,
				null,
				List.of(),
				Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS));
	}

	private static DailyPlan planOnDate(LocalDate date, long planId, Instant createdAt) {
		DailyPlan plan = scheduledPlan(date, planId);
		plan.setCreatedAt(createdAt);
		return plan;
	}

	private static DailyPlan scheduledPlan(LocalDate planDate, long planId) {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", planId);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		plan.setWindowStart(LocalTime.of(9, 0));
		plan.setWindowEnd(LocalTime.of(18, 0));

		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		revision.setFreeMinutes(480);
		revision.setScheduledWorkMinutes(0);
		revision.setRequiredMinutes(0L);
		revision.setRequestedBufferMinutes(0);
		revision.setRealizedBufferMinutes(0);
		revision.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		plan.addRevision(revision);
		return plan;
	}

	private static DailyPlanTask planTask(
			DailyPlanRevision revision,
			int rank,
			long sourceTaskId,
			Long taskReferenceId,
			String title,
			TaskPriority priority,
			TaskStatus status,
			LocalDate dueDate,
			Integer estimatedMinutes) {
		return planTask(
				revision,
				rank,
				sourceTaskId,
				taskReferenceId,
				title,
				priority,
				status,
				dueDate,
				estimatedMinutes,
				null,
				null);
	}

	private static DailyPlanTask planTask(
			DailyPlanRevision revision,
			int rank,
			long sourceTaskId,
			Long taskReferenceId,
			String title,
			TaskPriority priority,
			TaskStatus status,
			LocalDate dueDate,
			Integer estimatedMinutes,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes) {
		DailyPlanTask task = new DailyPlanTask();
		task.setRank(rank);
		task.setSourceTaskId(sourceTaskId);
		if (taskReferenceId != null) {
			Task reference = new Task();
			ReflectionTestUtils.setField(reference, "id", taskReferenceId);
			reference.setTitle(title);
			reference.setPriority(priority);
			reference.setStatus(status);
			reference.setDueDate(dueDate);
			reference.setRemainingEffortMinutes(estimatedMinutes);
			task.setTaskReference(reference);
		}
		task.setTaskTitle(title);
		task.setTaskPriority(priority);
		task.setTaskStatus(status);
		task.setTaskDueDate(dueDate);
		task.setTaskEstimatedMinutes(estimatedMinutes);
		task.setUnplacedReason(unplacedReason);
		task.setUnplacedMinutes(unplacedMinutes);
		revision.addTask(task);
		return task;
	}

	private static DailyPlanBlock planBlock(
			DailyPlanRevision revision,
			DailyPlanTask task,
			BlockKind kind,
			LocalTime start,
			LocalTime end,
			int position) {
		DailyPlanBlock block = new DailyPlanBlock();
		block.setKind(kind);
		block.setStartTime(start);
		block.setEndTime(end);
		block.setPosition(position);
		block.setDailyPlanTask(task);
		revision.addBlock(block);
		return block;
	}
}
