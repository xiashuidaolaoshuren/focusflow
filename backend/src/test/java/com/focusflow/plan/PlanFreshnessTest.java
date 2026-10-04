package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class PlanFreshnessTest {

	@Test
	void needsRefresh_whenCapturedRemainingEffortDisagreesWithTheLiveTask() {
		DailyPlan plan = planOf(planTask(40, liveTask(15, TaskStatus.OPEN)));

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	@Test
	void needsRefresh_isFalse_whenCapturedRemainingEffortMatchesTheLiveTask() {
		DailyPlan plan = planOf(planTask(40, liveTask(40, TaskStatus.OPEN)));

		assertThat(PlanFreshness.needsRefresh(plan)).isFalse();
	}

	@Test
	void needsRefresh_isFalse_whenEverySnapshotMatches() {
		DailyPlan plan =
				planOf(
						planTask(40, liveTask(1L, 40, TaskStatus.OPEN)),
						planTask(30, liveTask(2L, 30, TaskStatus.IN_PROGRESS)));

		assertThat(PlanFreshness.needsRefresh(plan)).isFalse();
	}

	@Test
	void needsRefresh_isTrue_whenAnActionableSnapshotTaskIsDone() {
		DailyPlan plan = planOf(planTask(40, liveTask(0, TaskStatus.DONE)));

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	@Test
	void needsRefresh_isTrue_whenAnActionableSnapshotTaskIsCancelled() {
		DailyPlan plan = planOf(planTask(40, liveTask(40, TaskStatus.CANCELLED)));

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	@Test
	void needsRefresh_isTrue_whenAnActionableSnapshotTaskIsGone() {
		DailyPlanTask orphan = planTask(40, liveTask(40, TaskStatus.OPEN));
		orphan.setTaskReference(null);
		orphan.setSourceTaskId(7L);

		DailyPlan plan = planOf(orphan);

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	@Test
	void needsRefresh_isFalse_whenOnlyAnEarlierRevisionLostItsTask() {
		DailyPlan plan = new DailyPlan();
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		plan.setWindowStart(LocalTime.of(9, 0));
		plan.setWindowEnd(LocalTime.of(18, 0));
		plan.setCadenceEnabled(true);

		DailyPlanRevision first = new DailyPlanRevision();
		first.setRevisionNumber(1);
		plan.addRevision(first);
		DailyPlanTask historical = planTask(40, liveTask(1L, 0, TaskStatus.DONE));
		historical.setRank(1);
		first.addTask(historical);

		DailyPlanRevision latest = new DailyPlanRevision();
		latest.setRevisionNumber(2);
		plan.addRevision(latest);
		DailyPlanTask current = planTask(30, liveTask(1L, 30, TaskStatus.OPEN));
		current.setRank(1);
		latest.addTask(current);

		assertThat(PlanFreshness.needsRefresh(plan)).isFalse();
	}

	@Test
	void needsRefresh_isFalse_forALegacyPlanWhoseLiveRemainderStillEqualsTheSnapshottedEstimate() {
		DailyPlan plan = legacyPlanOf(planTask(null, liveTask(90, TaskStatus.OPEN)));

		assertThat(PlanFreshness.needsRefresh(plan)).isFalse();
	}

	@Test
	void needsRefresh_isTrue_forALegacyPlanWhoseLiveRemainderMovedAwayFromTheEstimate() {
		DailyPlan plan = legacyPlanOf(planTask(null, liveTask(40, TaskStatus.OPEN)));

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	@Test
	void needsRefresh_isTrue_whenASnapshottedPlanCapturedAnUnknownRemainder() {
		DailyPlan plan = planOf(planTask(null, liveTask(15, TaskStatus.OPEN)));

		assertThat(PlanFreshness.needsRefresh(plan)).isTrue();
	}

	private static DailyPlan legacyPlanOf(DailyPlanTask... planTasks) {
		DailyPlan plan = planOf(planTasks);
		plan.setCadenceEnabled(null);
		return plan;
	}

	private static DailyPlan planOf(DailyPlanTask... planTasks) {
		DailyPlan plan = new DailyPlan();
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		plan.setWindowStart(LocalTime.of(9, 0));
		plan.setWindowEnd(LocalTime.of(18, 0));
		plan.setCadenceEnabled(true);
		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		plan.addRevision(revision);
		int rank = 1;
		for (DailyPlanTask planTask : planTasks) {
			planTask.setRank(rank++);
			revision.addTask(planTask);
		}
		return plan;
	}

	private static DailyPlanTask planTask(Integer capturedRemaining, Task live) {
		DailyPlanTask planTask = new DailyPlanTask();
		planTask.setSourceTaskId(live.getId() != null ? live.getId() : 0L);
		planTask.setTaskReference(live);
		planTask.setTaskTitle("Task");
		planTask.setTaskPriority(TaskPriority.MEDIUM);
		planTask.setTaskStatus(live.getStatus());
		planTask.setTaskEstimatedMinutes(90);
		planTask.setCapturedRemainingEffortMinutes(capturedRemaining);
		planTask.setMustInclude(true);
		return planTask;
	}

	private static Task liveTask(Integer remaining, TaskStatus status) {
		return liveTask(1L, remaining, status);
	}

	private static Task liveTask(long id, Integer remaining, TaskStatus status) {
		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", id);
		task.setTitle("Task " + id);
		task.setPriority(TaskPriority.MEDIUM);
		task.setStatus(status);
		task.setEstimatedMinutes(90);
		task.setRemainingEffortMinutes(remaining);
		return task;
	}
}
