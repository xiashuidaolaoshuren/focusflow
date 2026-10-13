package com.focusflow.plan;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.TaskDependencyEdge;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanScheduler {

	public DailyPlanSchedule compose(
			LocalDate planDate,
			List<Task> rankedTasks,
			EffectiveSchedulingPreferences preferences,
			List<CommitmentWindow> commitments) {
		return compose(planDate, rankedTasks, preferences, commitments, emptyCapture());
	}

	public DailyPlanSchedule compose(
			LocalDate planDate,
			List<Task> rankedTasks,
			EffectiveSchedulingPreferences preferences,
			List<CommitmentWindow> commitments,
			PlanDependencyCapture capture) {
		WorkWindow window =
				new WorkWindow(preferences.workDayStart(), preferences.workDayEnd());
		List<FixedBreakWindow> fixedBreaks =
				preferences.fixedBreaks().stream()
						.map(this::toFixedBreakWindow)
						.toList();

		FreeIntervalPlan stage1 =
				FreeIntervalPlanner.plan(
						window, fixedBreaks, commitments, preferences.bufferMinutes());

		List<RankedTask> ranking =
				rankedTasks.stream()
						.map(
								task ->
										new RankedTask(
												task.getId() != null ? task.getId() : 0L,
												task.getRemainingEffortMinutes()))
						.toList();
		PlacementPolicy policy =
				new PlacementPolicy(
						preferences.cadenceEnabled(),
						preferences.targetFocusMinutes(),
						preferences.breakMinutes(),
						preferences.minSessionMinutes());
		Set<Long> rankedIds = new HashSet<>();
		for (Task task : rankedTasks) {
			rankedIds.add(task.getId() != null ? task.getId() : 0L);
		}
		List<TaskDependencyEdge> edges = dependencyEdges(capture.links(), rankedIds);
		PlacementResult result = WorkPlacementPlanner.place(stage1, ranking, policy, edges);
		SchedulePostconditionValidator.validate(window, stage1, ranking, edges, result);

		return new DailyPlanSchedule(
				preferences.workDayStart(),
				preferences.workDayEnd(),
				preferences.peakStart(),
				preferences.peakEnd(),
				stage1.freeMinutes(),
				sumWorkMinutes(result.blocks()),
				sumRequiredMinutes(rankedTasks, capture),
				stage1.requestedBufferMinutes(),
				stage1.realizedBufferMinutes(),
				result.blocks(),
				result.unplacedWork(),
				preferences.cadenceEnabled(),
				preferences.targetFocusMinutes(),
				preferences.breakMinutes(),
				preferences.minSessionMinutes(),
				preferences.bufferMinutes(),
				fixedBreaks);
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

	private static long sumRequiredMinutes(List<Task> rankedTasks, PlanDependencyCapture capture) {
		Map<Long, RankingGroup> groupByTaskId = new HashMap<>();
		for (InheritedAssignment assignment : capture.assignments()) {
			groupByTaskId.put(assignment.taskId(), assignment.group());
		}
		long total = 0L;
		for (Task task : rankedTasks) {
			long taskId = task.getId() != null ? task.getId() : 0L;
			RankingGroup group = groupByTaskId.getOrDefault(taskId, RankingGroup.OPTIONAL);
			if (PlanMustIncludeRules.isInheritedMustInclude(group)
					&& task.getRemainingEffortMinutes() != null) {
				total += task.getRemainingEffortMinutes();
			}
		}
		return total;
	}

	private static List<TaskDependencyEdge> dependencyEdges(
			List<DependencyLink> links, Set<Long> rankedIds) {
		return links.stream()
				.filter(
						link ->
								link.blockerPlannable()
										&& rankedIds.contains(link.blockerId())
										&& rankedIds.contains(link.blockedId()))
				.map(link -> new TaskDependencyEdge(link.blockerId(), link.blockedId()))
				.toList();
	}

	private static PlanDependencyCapture emptyCapture() {
		return new PlanDependencyCapture(List.of(), List.of(), Map.of());
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}
}
