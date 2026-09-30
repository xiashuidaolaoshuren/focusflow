package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
class DailyPlanSchedulerTest {

	@Mock
	private SchedulingPreferencesQueryService schedulingPreferencesQueryService;

	@Mock
	private CommitmentQueryService commitmentQueryService;

	private DailyPlanScheduler scheduler;

	@BeforeEach
	void setUp() {
		scheduler =
				new DailyPlanScheduler(
						schedulingPreferencesQueryService, commitmentQueryService);
	}

	@Test
	void compose_withDefaultsAndOneTask_placesWorkAndDerivesMetrics() {
		Long ownerId = 42L;
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 90, TaskStatus.OPEN);

		when(schedulingPreferencesQueryService.effectiveFor(ownerId))
				.thenReturn(defaultPreferences());
		when(commitmentQueryService.windowsFor(ownerId, planDate)).thenReturn(List.of());

		DailyPlanSchedule schedule = scheduler.compose(ownerId, planDate, List.of(task));

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
		Long ownerId = 42L;
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task task = createTask(7L, 30, TaskStatus.IN_PROGRESS);

		when(schedulingPreferencesQueryService.effectiveFor(ownerId))
				.thenReturn(
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
												LocalTime.of(13, 0)))));
		when(commitmentQueryService.windowsFor(ownerId, planDate))
				.thenReturn(
						List.of(
								new com.focusflow.schedule.CommitmentWindow(
										"Standup",
										LocalTime.of(10, 0),
										LocalTime.of(11, 0))));

		DailyPlanSchedule schedule = scheduler.compose(ownerId, planDate, List.of(task));

		assertThat(schedule.freeMinutes()).isEqualTo(420);
		assertThat(schedule.requiredMinutes()).isEqualTo(30L);
		assertThat(schedule.blocks())
				.anyMatch(block -> block.kind() == BlockKind.COMMITMENT)
				.anyMatch(block -> block.kind() == BlockKind.FIXED_BREAK)
				.anyMatch(block -> block.kind() == BlockKind.WORK);
	}

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
