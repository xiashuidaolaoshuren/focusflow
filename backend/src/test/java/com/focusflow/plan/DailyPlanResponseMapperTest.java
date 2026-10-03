package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.effort.WorkOutcome;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.ScheduledBlockResponse;
import com.focusflow.plan.dto.UnplacedWorkResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DailyPlanResponseMapperTest {

	private DailyPlanResponseMapper mapper;

	@BeforeEach
	void setUp() {
		mapper = new DailyPlanResponseMapper();
	}

	@Test
	void toResponse_mapsWorkBlocksWithSessionGroupingAndNonWorkLabels() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();

		DailyPlanTask task = planTask(
				revision,
				1,
				10L,
				10L,
				"Deep work",
				TaskPriority.HIGH,
				TaskStatus.OPEN,
				null,
				100,
				false,
				null,
				null);

		planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), null, 1);
		planBlock(revision, task, BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(10, 30), null, 2);
		planBlock(
				revision,
				null,
				BlockKind.FIXED_BREAK,
				LocalTime.of(9, 50),
				LocalTime.of(10, 0),
				"Lunch prep",
				3);

		DailyPlanResponse response = mapper.toResponse(plan);

		assertThat(response.blocks()).hasSize(3);

		ScheduledBlockResponse firstWork = response.blocks().get(0);
		assertThat(firstWork.kind()).isEqualTo(BlockKind.WORK);
		assertThat(firstWork.startTime()).isEqualTo(LocalTime.of(9, 0));
		assertThat(firstWork.endTime()).isEqualTo(LocalTime.of(9, 50));
		assertThat(firstWork.sessionIndex()).isEqualTo(1);
		assertThat(firstWork.sessionCount()).isEqualTo(2);
		assertThat(firstWork.taskSnapshot().sourceTaskId()).isEqualTo(10L);
		assertThat(firstWork.taskSnapshot().title()).isEqualTo("Deep work");
		assertThat(firstWork.label()).isNull();

		ScheduledBlockResponse secondWork = response.blocks().get(1);
		assertThat(secondWork.sessionIndex()).isEqualTo(2);
		assertThat(secondWork.sessionCount()).isEqualTo(2);

		ScheduledBlockResponse fixedBreak = response.blocks().get(2);
		assertThat(fixedBreak.kind()).isEqualTo(BlockKind.FIXED_BREAK);
		assertThat(fixedBreak.label()).isEqualTo("Lunch prep");
		assertThat(fixedBreak.taskSnapshot()).isNull();
		assertThat(fixedBreak.sessionIndex()).isNull();
		assertThat(fixedBreak.sessionCount()).isNull();
	}

	@Test
	void toResponse_mapsUnplacedWorkFromPlanTasks() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();

		planTask(
				revision,
				1,
				20L,
				20L,
				"Overdue task",
				TaskPriority.MEDIUM,
				TaskStatus.OPEN,
				LocalDate.of(2026, 6, 1),
				60,
				true,
				UnplacedReason.OUT_OF_TIME,
				30);

		DailyPlanResponse response = mapper.toResponse(plan);

		assertThat(response.unplacedWork()).hasSize(1);
		UnplacedWorkResponse entry = response.unplacedWork().get(0);
		assertThat(entry.reason()).isEqualTo(UnplacedReason.OUT_OF_TIME);
		assertThat(entry.unplacedMinutes()).isEqualTo(30);
		assertThat(entry.taskSnapshot().sourceTaskId()).isEqualTo(20L);
		assertThat(entry.taskSnapshot().mustInclude()).isTrue();
	}

	@Test
	void toResponse_warningIsNull_whenNoMustIncludeTaskIsUnplaced() {
		DailyPlan plan = scheduledPlan();
		planTask(
				plan.getLatestRevision(),
				1,
				10L,
				10L,
				"Optional overflow",
				TaskPriority.LOW,
				TaskStatus.OPEN,
				null,
				30,
				false,
				UnplacedReason.OUT_OF_TIME,
				30);

		assertThat(mapper.toResponse(plan).warning()).isNull();
	}

	@Test
	void toResponse_derivesWarningFromMustIncludeOutOfTimeTasks() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();
		revision.setFreeMinutes(300);
		revision.setScheduledWorkMinutes(120);
		revision.setRequiredMinutes(180L);
		planTask(
				revision,
				1,
				20L,
				20L,
				"Overdue task",
				TaskPriority.MEDIUM,
				TaskStatus.OPEN,
				LocalDate.of(2026, 6, 1),
				60,
				true,
				UnplacedReason.OUT_OF_TIME,
				30);

		DailyPlanWarning warning = mapper.toResponse(plan).warning();

		assertThat(warning).isNotNull();
		assertThat(warning.requiredMinutes()).isEqualTo(180L);
		assertThat(warning.freeMinutes()).isEqualTo(300);
		assertThat(warning.scheduledWorkMinutes()).isEqualTo(120);
		assertThat(warning.outOfTimeTasks())
				.singleElement()
				.satisfies(
						task -> {
							assertThat(task.sourceTaskId()).isEqualTo(20L);
							assertThat(task.title()).isEqualTo("Overdue task");
							assertThat(task.unplacedMinutes()).isEqualTo(30);
						});
		assertThat(warning.unestimatedTasks()).isEmpty();
	}

	@Test
	void toResponse_derivesWarningFromMustIncludeUnestimatedTasks() {
		DailyPlan plan = scheduledPlan();
		planTask(
				plan.getLatestRevision(),
				1,
				30L,
				30L,
				"No estimate",
				TaskPriority.HIGH,
				TaskStatus.IN_PROGRESS,
				null,
				null,
				true,
				UnplacedReason.NO_ESTIMATE,
				null);

		DailyPlanWarning warning = mapper.toResponse(plan).warning();

		assertThat(warning).isNotNull();
		assertThat(warning.unestimatedTasks())
				.singleElement()
				.satisfies(
						task -> {
							assertThat(task.sourceTaskId()).isEqualTo(30L);
							assertThat(task.title()).isEqualTo("No estimate");
						});
		assertThat(warning.outOfTimeTasks()).isEmpty();
	}

	@Test
	void toResponse_mapsBlockProgressFieldsAndActionableDisplayState() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();
		ReflectionTestUtils.setField(revision, "id", 71L);
		DailyPlanTask task =
				planTask(
						revision,
						1,
						10L,
						10L,
						"Deep work",
						TaskPriority.HIGH,
						TaskStatus.IN_PROGRESS,
						null,
						100,
						false,
						null,
						null);
		planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), null, 1);
		DailyPlanBlock block = revision.getBlocks().iterator().next();
		ReflectionTestUtils.setField(block, "id", 61L);
		block.setOutcome("PARTLY_DONE");
		block.setActualMinutes(35);
		block.setRecordedAt(Instant.parse("2026-06-01T09:30:00Z"));
		block.setProgressVersion(3);
		block.setReconciled(true);

		ScheduledBlockResponse response = mapper.toResponse(plan).blocks().get(0);

		assertThat(response.id()).isEqualTo(61L);
		assertThat(response.revisionId()).isEqualTo(71L);
		assertThat(response.outcome()).isEqualTo(WorkOutcome.PARTLY_DONE);
		assertThat(response.actualMinutes()).isEqualTo(35);
		assertThat(response.reconciled()).isTrue();
		assertThat(response.progressVersion()).isEqualTo(3);
		assertThat(response.displayState()).isEqualTo(BlockDisplayState.ACTIONABLE);
	}

	@Test
	void toResponse_reportsNoProgressOnAnUnrecordedBlock() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask task =
				planTask(
						revision,
						1,
						10L,
						10L,
						"Deep work",
						TaskPriority.HIGH,
						TaskStatus.OPEN,
						null,
						100,
						false,
						null,
						null);
		planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), null, 1);

		ScheduledBlockResponse response = mapper.toResponse(plan).blocks().get(0);

		assertThat(response.outcome()).isNull();
		assertThat(response.actualMinutes()).isNull();
		assertThat(response.reconciled()).isFalse();
		assertThat(response.progressVersion()).isZero();
		assertThat(response.displayState()).isEqualTo(BlockDisplayState.ACTIONABLE);
	}

	@Test
	void toResponse_marksAnUnusedSessionOfAFinishedTaskAsNoLongerNeeded() {
		DailyPlan plan = scheduledPlan();
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask task =
				planTask(
						revision,
						1,
						10L,
						10L,
						"Deep work",
						TaskPriority.HIGH,
						TaskStatus.OPEN,
						null,
						100,
						false,
						null,
						null);
		task.getTaskReference().setStatus(TaskStatus.DONE);
		planBlock(revision, task, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), null, 1);

		ScheduledBlockResponse response = mapper.toResponse(plan).blocks().get(0);

		assertThat(response.outcome()).isNull();
		assertThat(response.displayState()).isEqualTo(BlockDisplayState.NO_LONGER_NEEDED);
	}

	private static DailyPlan scheduledPlan() {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", 1L);
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		plan.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		plan.setWindowStart(LocalTime.of(9, 0));
		plan.setWindowEnd(LocalTime.of(18, 0));

		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		revision.setFreeMinutes(480);
		revision.setScheduledWorkMinutes(80);
		revision.setRequiredMinutes(100L);
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
			Long taskReferenceIdValue,
			String title,
			TaskPriority priority,
			TaskStatus status,
			LocalDate dueDate,
			Integer estimatedMinutes,
			boolean mustInclude,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes) {
		DailyPlanTask task = new DailyPlanTask();
		task.setRank(rank);
		task.setSourceTaskId(sourceTaskId);
		if (taskReferenceIdValue != null) {
			com.focusflow.task.Task reference = new com.focusflow.task.Task();
			ReflectionTestUtils.setField(reference, "id", taskReferenceIdValue);
			task.setTaskReference(reference);
		}
		task.setTaskTitle(title);
		task.setTaskPriority(priority);
		task.setTaskStatus(status);
		task.setTaskDueDate(dueDate);
		task.setTaskEstimatedMinutes(estimatedMinutes);
		task.setMustInclude(mustInclude);
		task.setUnplacedReason(unplacedReason);
		task.setUnplacedMinutes(unplacedMinutes);
		revision.addTask(task);
		return task;
	}

	private static void planBlock(
			DailyPlanRevision revision,
			DailyPlanTask task,
			BlockKind kind,
			LocalTime start,
			LocalTime end,
			String label,
			int position) {
		DailyPlanBlock block = new DailyPlanBlock();
		block.setKind(kind);
		block.setStartTime(start);
		block.setEndTime(end);
		block.setLabel(label);
		block.setPosition(position);
		block.setDailyPlanTask(task);
		revision.addBlock(block);
	}
}
