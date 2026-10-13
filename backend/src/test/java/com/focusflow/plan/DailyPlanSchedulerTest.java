package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.plan.PlanDependencyCapture;
import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.FixedBreakWindow;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.schedule.UnplacedWork;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DailyPlanSchedulerTest {

	@Test
	void compose_withDefaultsAndOneTask_placesWorkAndDerivesMetrics() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 90, TaskStatus.OPEN);

		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), defaultPreferences(), List.of());

		assertThat(schedule.windowStart()).isEqualTo(SchedulingPreferenceDefaults.WORK_DAY_START);
		assertThat(schedule.windowEnd()).isEqualTo(SchedulingPreferenceDefaults.WORK_DAY_END);
		assertThat(schedule.freeMinutes()).isEqualTo(540);
		assertThat(schedule.scheduledWorkMinutes()).isEqualTo(90);
		assertThat(schedule.requiredMinutes()).isZero();
		assertThat(schedule.blocks())
				.filteredOn(block -> block.kind() == BlockKind.WORK && block.sourceTaskId() == 7L)
				.extracting(ScheduledBlock::start, ScheduledBlock::end)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(LocalTime.of(9, 0), LocalTime.of(9, 50)),
						org.assertj.core.groups.Tuple.tuple(LocalTime.of(10, 0), LocalTime.of(10, 40)));
		assertThat(schedule.unplacedWork()).isEmpty();
	}

	@Test
	void compose_withCommitmentAndFixedBreak_subtractsBothFromFreeMinutes() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 30, TaskStatus.IN_PROGRESS);

		EffectiveSchedulingPreferences preferences =
				new EffectiveSchedulingPreferences(
						LocalTime.of(9, 0),
						LocalTime.of(18, 0),
						false,
						50,
						10,
						15,
						0,
						null,
						null,
						List.of(
								new EffectiveFixedBreak(
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Standup", LocalTime.of(10, 0), LocalTime.of(11, 0)));

		PlanDependencyCapture capture =
				captureAssignments(
						new InheritedAssignment(7L, RankingGroup.MUST_CONTINUE, null, 7L));
		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), preferences, commitments, capture);

		assertThat(schedule.freeMinutes()).isEqualTo(420);
		assertThat(schedule.requiredMinutes()).isEqualTo(30L);
		assertThat(schedule.blocks())
				.anyMatch(block -> block.kind() == BlockKind.COMMITMENT)
				.anyMatch(block -> block.kind() == BlockKind.FIXED_BREAK)
				.anyMatch(block -> block.kind() == BlockKind.WORK);
	}

	@Test
	void compose_placesCapturedRemainingEffortInsteadOfTheWholeTaskEstimate() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 200, 40, TaskStatus.OPEN);

		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), defaultPreferences(), List.of());

		assertThat(schedule.scheduledWorkMinutes()).isEqualTo(40);
		assertThat(schedule.unplacedWork()).isEmpty();
	}

	@Test
	void compose_whenRemainingEffortUnknown_leavesOneNoEstimateRowAndNoWorkBlock() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 30, null, TaskStatus.OPEN);

		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), defaultPreferences(), List.of());

		assertThat(schedule.blocks())
				.noneMatch(block -> block.kind() == BlockKind.WORK && block.sourceTaskId() == 7L);
		assertThat(schedule.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.NO_ESTIMATE, null));
	}

	@Test
	void compose_whenRemainingEffortExceedsTheWindow_conservesItAsScheduledPlusOutOfTime() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 1000, 600, TaskStatus.OPEN);

		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), defaultPreferences(), List.of());

		int outOfTime =
				schedule.unplacedWork().stream()
						.filter(unplaced -> unplaced.sourceTaskId() == 7L)
						.mapToInt(UnplacedWork::unplacedMinutes)
						.sum();
		assertThat(schedule.scheduledWorkMinutes() + outOfTime).isEqualTo(600);
	}

	@Test
	void compose_requiredMinutes_sumsKnownRemainingEffortOnMustIncludeCandidates() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task inProgress = createTask(7L, 90, 40, TaskStatus.IN_PROGRESS);
		Task unknownRemainder = createTask(8L, 30, null, TaskStatus.IN_PROGRESS);
		Task futureDue = createTask(9L, 25, 25, TaskStatus.OPEN);
		futureDue.setDueDate(LocalDate.of(2026, 6, 5));

		PlanDependencyCapture capture =
				captureAssignments(
						new InheritedAssignment(7L, RankingGroup.MUST_CONTINUE, null, 7L),
						new InheritedAssignment(8L, RankingGroup.MUST_CONTINUE, null, 8L),
						new InheritedAssignment(9L, RankingGroup.OPTIONAL, null, 9L));
		DailyPlanSchedule schedule =
				scheduler.compose(
						planDate,
						List.of(inProgress, unknownRemainder, futureDue),
						defaultPreferences(),
						List.of(),
						capture);

		assertThat(schedule.requiredMinutes()).isEqualTo(40L);
	}

	@Test
	void compose_carriesTheSchedulingPolicyItUsed() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 30, 30, TaskStatus.OPEN);
		EffectiveSchedulingPreferences preferences =
				new EffectiveSchedulingPreferences(
						LocalTime.of(9, 0),
						LocalTime.of(18, 0),
						false,
						45,
						7,
						20,
						12,
						null,
						null,
						List.of(
								new EffectiveFixedBreak(
										"Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0))),
						Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS));

		DailyPlanSchedule schedule =
				scheduler.compose(planDate, List.of(task), preferences, List.of());

		assertThat(schedule.cadenceEnabled()).isFalse();
		assertThat(schedule.targetFocusMinutes()).isEqualTo(45);
		assertThat(schedule.breakMinutes()).isEqualTo(7);
		assertThat(schedule.minSessionMinutes()).isEqualTo(20);
		assertThat(schedule.bufferMinutes()).isEqualTo(12);
		assertThat(schedule.fixedBreaks())
				.containsExactly(
						new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));
	}

	private final DailyPlanScheduler scheduler = new DailyPlanScheduler();

	private EffectiveSchedulingPreferences defaultPreferences() {
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

	private Task createTask(long id, int estimatedMinutes, TaskStatus status) {
		return createTask(id, estimatedMinutes, estimatedMinutes, status);
	}

	private Task createTask(
			long id, Integer estimatedMinutes, Integer remainingEffortMinutes, TaskStatus status) {
		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", id);
		task.setTitle("Task " + id);
		task.setEstimatedMinutes(estimatedMinutes);
		task.setRemainingEffortMinutes(remainingEffortMinutes);
		task.setStatus(status);
		task.setPriority(TaskPriority.MEDIUM);
		return task;
	}

	private static PlanDependencyCapture captureAssignments(InheritedAssignment... assignments) {
		return new PlanDependencyCapture(List.of(), List.of(assignments), Map.of());
	}
}
