package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.focusflow.common.error.ConflictException;
import com.focusflow.effort.WorkOutcome;
import com.focusflow.schedule.BlockKind;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PlanReplacePreconditionsTest {

	@Test
	void validateReplacePrecondition_whenAnyBlockHasOutcome_throwsPlanHasProgress() {
		DailyPlan plan = planWithSkippedBlock(5L);

		assertThatThrownBy(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), 5L))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PLAN_HAS_PROGRESS"));
	}

	@Test
	void validateReplacePrecondition_whenProgressExistsAndReplaceIdMissing_stillThrowsPlanHasProgress() {
		DailyPlan plan = planWithSkippedBlock(5L);

		assertThatThrownBy(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), null))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PLAN_HAS_PROGRESS"));
	}

	@Test
	void validateReplacePrecondition_whenProgressExistsAndReplaceIdStale_stillThrowsPlanHasProgress() {
		DailyPlan plan = planWithSkippedBlock(5L);

		assertThatThrownBy(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), 9L))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("PLAN_HAS_PROGRESS"));
	}

	@Test
	void validateReplacePrecondition_whenMatchingReplaceIdAndNoOutcome_doesNotThrow() {
		DailyPlan plan = outcomeFreePlan(5L);

		assertThatCode(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), 5L))
				.doesNotThrowAnyException();
	}

	@Test
	void validateReplacePrecondition_whenNoOutcomeAndReplaceIdMissing_throwsPlanExists() {
		DailyPlan plan = outcomeFreePlan(5L);

		assertThatThrownBy(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), null))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_EXISTS"));
	}

	@Test
	void validateReplacePrecondition_whenNoOutcomeAndReplaceIdStale_throwsPlanChanged() {
		DailyPlan plan = outcomeFreePlan(5L);

		assertThatThrownBy(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), 9L))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_CHANGED"));
	}

	@Test
	void validateReplacePrecondition_whenNoLongerNeededBlockHasNoOutcome_doesNotThrow() {
		DailyPlan plan = noLongerNeededPlan(5L);

		assertThatCode(
						() ->
								PlanReplacePreconditions.validateReplacePrecondition(
										Optional.of(plan), 5L))
				.doesNotThrowAnyException();
	}

	private static DailyPlan planWithSkippedBlock(long id) {
		DailyPlan plan = outcomeFreePlan(id);
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanBlock block = new DailyPlanBlock();
		block.setKind(BlockKind.WORK);
		block.setStartTime(LocalTime.of(9, 0));
		block.setEndTime(LocalTime.of(9, 50));
		block.setPosition(1);
		block.setOutcome(WorkOutcome.SKIPPED.name());
		revision.addBlock(block);
		return plan;
	}

	private static DailyPlan noLongerNeededPlan(long id) {
		DailyPlan plan = outcomeFreePlan(id);
		DailyPlanRevision revision = plan.getLatestRevision();
		DailyPlanTask planTask = new DailyPlanTask();
		planTask.setRank(1);
		planTask.setSourceTaskId(10L);
		planTask.setTaskTitle("Finished work");
		planTask.setTaskPriority(com.focusflow.task.TaskPriority.MEDIUM);
		planTask.setTaskStatus(com.focusflow.task.TaskStatus.OPEN);
		planTask.setMustInclude(false);
		com.focusflow.task.Task reference = new com.focusflow.task.Task();
		reference.setStatus(com.focusflow.task.TaskStatus.DONE);
		ReflectionTestUtils.setField(reference, "id", 10L);
		planTask.setTaskReference(reference);
		revision.addTask(planTask);

		DailyPlanBlock block = new DailyPlanBlock();
		block.setKind(BlockKind.WORK);
		block.setStartTime(LocalTime.of(9, 0));
		block.setEndTime(LocalTime.of(9, 50));
		block.setPosition(1);
		block.setDailyPlanTask(planTask);
		revision.addBlock(block);
		return plan;
	}

	private static DailyPlan outcomeFreePlan(long id) {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", id);
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		plan.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));

		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		revision.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		plan.addRevision(revision);
		return plan;
	}
}
