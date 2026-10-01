package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
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
										LocalTime.of(13, 0))));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Standup", LocalTime.of(10, 0), LocalTime.of(11, 0)));

		DailyPlanSchedule schedule = scheduler.compose(planDate, List.of(task), preferences, commitments);

		assertThat(schedule.freeMinutes()).isEqualTo(420);
		assertThat(schedule.requiredMinutes()).isEqualTo(30L);
		assertThat(schedule.blocks())
				.anyMatch(block -> block.kind() == BlockKind.COMMITMENT)
				.anyMatch(block -> block.kind() == BlockKind.FIXED_BREAK)
				.anyMatch(block -> block.kind() == BlockKind.WORK);
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
				List.of());
	}

	private Task createTask(long id, int estimatedMinutes, TaskStatus status) {
		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", id);
		task.setTitle("Task " + id);
		task.setEstimatedMinutes(estimatedMinutes);
		task.setStatus(status);
		task.setPriority(TaskPriority.MEDIUM);
		return task;
	}
}
