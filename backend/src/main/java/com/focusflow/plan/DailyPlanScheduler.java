package com.focusflow.plan;

import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.FixedBreakWindow;
import com.focusflow.schedule.FreeIntervalPlan;
import com.focusflow.schedule.FreeIntervalPlanner;
import com.focusflow.schedule.PlacementPolicy;
import com.focusflow.schedule.PlacementResult;
import com.focusflow.schedule.RankedTask;
import com.focusflow.schedule.SchedulePostconditionValidator;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.WorkPlacementPlanner;
import com.focusflow.schedule.WorkWindow;
import com.focusflow.task.Task;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanScheduler {

	private final SchedulingPreferencesQueryService schedulingPreferencesQueryService;
	private final CommitmentQueryService commitmentQueryService;

	public DailyPlanScheduler(
			SchedulingPreferencesQueryService schedulingPreferencesQueryService,
			CommitmentQueryService commitmentQueryService) {
		this.schedulingPreferencesQueryService = schedulingPreferencesQueryService;
		this.commitmentQueryService = commitmentQueryService;
	}

	public DailyPlanSchedule compose(Long ownerId, LocalDate planDate, List<Task> rankedTasks) {
		EffectiveSchedulingPreferences preferences =
				schedulingPreferencesQueryService.effectiveFor(ownerId);
		WorkWindow window =
				new WorkWindow(preferences.workDayStart(), preferences.workDayEnd());
		List<FixedBreakWindow> fixedBreaks =
				preferences.fixedBreaks().stream()
						.map(this::toFixedBreakWindow)
						.toList();
		List<CommitmentWindow> commitments =
				commitmentQueryService.windowsFor(ownerId, planDate);

		FreeIntervalPlan stage1 =
				FreeIntervalPlanner.plan(
						window, fixedBreaks, commitments, preferences.bufferMinutes());

		List<RankedTask> ranking =
				rankedTasks.stream()
						.map(
								task ->
										new RankedTask(
												task.getId() != null ? task.getId() : 0L,
												task.getEstimatedMinutes()))
						.toList();
		PlacementPolicy policy =
				new PlacementPolicy(
						preferences.cadenceEnabled(),
						preferences.targetFocusMinutes(),
						preferences.breakMinutes(),
						preferences.minSessionMinutes());
		PlacementResult result = WorkPlacementPlanner.place(stage1, ranking, policy);
		SchedulePostconditionValidator.validate(window, stage1, ranking, result);

		return new DailyPlanSchedule(
				preferences.workDayStart(),
				preferences.workDayEnd(),
				preferences.peakStart(),
				preferences.peakEnd(),
				stage1.freeMinutes(),
				sumWorkMinutes(result.blocks()),
				sumRequiredMinutes(rankedTasks, planDate),
				stage1.requestedBufferMinutes(),
				stage1.realizedBufferMinutes(),
				result.blocks(),
				result.unplacedWork());
	}

	private FixedBreakWindow toFixedBreakWindow(EffectiveFixedBreak fixedBreak) {
		return new FixedBreakWindow(
				fixedBreak.label(), fixedBreak.startTime(), fixedBreak.endTime());
	}

	private static int sumWorkMinutes(List<ScheduledBlock> blocks) {
		int total = 0;
		for (ScheduledBlock block : blocks) {
			if (block.kind() == BlockKind.WORK) {
				total += minutesBetween(block.start(), block.end());
			}
		}
		return total;
	}

	private static long sumRequiredMinutes(List<Task> rankedTasks, LocalDate planDate) {
		long total = 0L;
		for (Task task : rankedTasks) {
			if (PlanMustIncludeRules.isMustInclude(task, planDate)
					&& task.getEstimatedMinutes() != null) {
				total += task.getEstimatedMinutes();
			}
		}
		return total;
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}
}
