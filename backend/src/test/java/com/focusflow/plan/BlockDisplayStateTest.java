package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.schedule.BlockKind;
import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import com.focusflow.testsupport.DailyPlanTestBuilder;
import com.focusflow.testsupport.TaskTestBuilder;
import com.focusflow.user.User;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class BlockDisplayStateTest {

	private static final LocalDate PLAN_DATE = LocalDate.of(2026, 10, 5);

	@Test
	void of_sessionOnTheLatestRevision_isActionable() {
		DailyPlan plan = planWithTask(TaskStatus.OPEN);
		addWorkBlock(plan.getLatestRevision(), LocalTime.of(9, 0), LocalTime.of(9, 50), 61L);

		assertThat(BlockDisplayState.of(plan, firstBlock(plan)))
				.isEqualTo(BlockDisplayState.ACTIONABLE);
	}

	@Test
	void of_unusedSessionOfFinishedOrCancelledTask_isNoLongerNeeded() {
		DailyPlan donePlan = planWithTask(TaskStatus.DONE);
		addWorkBlock(donePlan.getLatestRevision(), LocalTime.of(9, 0), LocalTime.of(9, 50), 62L);
		DailyPlan cancelledPlan = planWithTask(TaskStatus.CANCELLED);
		addWorkBlock(
				cancelledPlan.getLatestRevision(), LocalTime.of(9, 0), LocalTime.of(9, 50), 63L);

		assertThat(BlockDisplayState.of(donePlan, firstBlock(donePlan)))
				.isEqualTo(BlockDisplayState.NO_LONGER_NEEDED);
		assertThat(BlockDisplayState.of(cancelledPlan, firstBlock(cancelledPlan)))
				.isEqualTo(BlockDisplayState.NO_LONGER_NEEDED);
	}

	@Test
	void of_recordedSessionOfFinishedTask_staysActionable() {
		DailyPlan plan = planWithTask(TaskStatus.DONE);
		DailyPlanBlock block =
				addWorkBlock(plan.getLatestRevision(), LocalTime.of(9, 0), LocalTime.of(9, 50), 64L);
		block.setOutcome("DONE");

		assertThat(BlockDisplayState.of(plan, block)).isEqualTo(BlockDisplayState.ACTIONABLE);
	}

	@Test
	void of_sessionStartingAtOrAfterTheLatestCutoff_isSuperseded() {
		DailyPlan plan = planWithTask(TaskStatus.OPEN);
		DailyPlanBlock block =
				addWorkBlock(plan.getLatestRevision(), LocalTime.of(10, 30), LocalTime.of(11, 20), 65L);
		appendRevision(plan, 2, LocalTime.of(10, 0));

		assertThat(BlockDisplayState.of(plan, block)).isEqualTo(BlockDisplayState.SUPERSEDED);
	}

	@Test
	void of_sessionEndingBeforeTheLatestCutoff_isHistorical() {
		DailyPlan plan = planWithTask(TaskStatus.OPEN);
		DailyPlanBlock block =
				addWorkBlock(plan.getLatestRevision(), LocalTime.of(8, 0), LocalTime.of(8, 50), 66L);
		appendRevision(plan, 2, LocalTime.of(10, 0));

		assertThat(BlockDisplayState.of(plan, block)).isEqualTo(BlockDisplayState.HISTORICAL);
	}

	@Test
	void of_olderRevisionWithoutCutoff_fallsBackToTheWindowStart() {
		DailyPlan plan = planWithTask(TaskStatus.OPEN);
		DailyPlanBlock block =
				addWorkBlock(plan.getLatestRevision(), LocalTime.of(9, 30), LocalTime.of(10, 20), 67L);
		appendRevision(plan, 2, null);

		assertThat(BlockDisplayState.of(plan, block)).isEqualTo(BlockDisplayState.SUPERSEDED);
	}

	private static DailyPlan planWithTask(TaskStatus status) {
		User owner = new User();
		Task task =
				TaskTestBuilder.task(owner)
						.withTitle("Write report")
						.withStatus(status)
						.withEstimatedMinutes(100)
						.build();
		return DailyPlanTestBuilder.plan(owner, PLAN_DATE)
				.addTask(task, 1, true, null, null)
				.buildTasksOnly();
	}

	private static DailyPlanBlock addWorkBlock(
			DailyPlanRevision revision, LocalTime start, LocalTime end, long blockId) {
		DailyPlanBlock block = new DailyPlanBlock();
		block.setKind(BlockKind.WORK);
		block.setStartTime(start);
		block.setEndTime(end);
		block.setPosition(1);
		block.setDailyPlanTask(revision.getTasks().iterator().next());
		org.springframework.test.util.ReflectionTestUtils.setField(block, "id", blockId);
		revision.addBlock(block);
		return block;
	}

	private static void appendRevision(
			DailyPlan plan, int revisionNumber, LocalTime cutoffTime) {
		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(revisionNumber);
		revision.setCutoffTime(cutoffTime);
		plan.addRevision(revision);
	}

	private static DailyPlanBlock firstBlock(DailyPlan plan) {
		return plan.getLatestRevision().getBlocks().iterator().next();
	}
}
