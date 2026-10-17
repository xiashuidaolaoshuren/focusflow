package com.focusflow.plan.dto;

import com.focusflow.horizon.HorizonForecast;
import com.focusflow.horizon.HorizonForecast.CreditExclusion;
import com.focusflow.horizon.HorizonForecast.DeadlineStatus;
import com.focusflow.horizon.HorizonForecast.HorizonSegment;
import com.focusflow.horizon.HorizonForecast.UnplacedScope;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskStatus;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public record HorizonResponse(
		LocalDate currentDate,
		LocalTime currentTime,
		Assumptions assumptions,
		List<DayResponse> days,
		List<TaskRowResponse> tasks) {

	public record Assumptions(String pace, List<DayOfWeek> workingDays, int horizonWorkingDays) {}

	public record DayResponse(
			LocalDate date,
			HorizonForecast.DayKind kind,
			Long planId,
			Boolean needsRefresh,
			List<Long> dependenciesIgnored) {}

	public record TaskRowResponse(
			long taskId,
			String title,
			TaskStatus status,
			LocalDate dueDate,
			Integer remainingEffortMinutes,
			DeadlineStatus deadlineStatus,
			LocalDate projectedFinishDate,
			List<DependencyRef> waitingOn,
			List<DependencyRef> upstreamBlockers,
			List<DependencyRef> unresolvedEffort,
			List<SegmentResponse> segments) {}

	public record DependencyRef(long taskId, String title) {}

	public record SegmentResponse(
			LocalDate date,
			int minutes,
			Integer assumedCreditMinutes,
			List<CreditExclusion> creditExclusions,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes,
			UnplacedScope unplacedScope) {}

	public static HorizonResponse from(HorizonForecast forecast, Set<DayOfWeek> workingDays) {
		List<DayOfWeek> sortedWorkingDays =
				workingDays.stream().sorted().collect(Collectors.toList());
		Assumptions assumptions =
				new Assumptions("AS_PLANNED", List.copyOf(sortedWorkingDays), 7);
		List<DayResponse> days =
				forecast.days().stream()
						.map(
								day ->
										new DayResponse(
												day.date(),
												day.kind(),
												day.planId(),
												day.kind() == HorizonForecast.DayKind.SAVED
														? day.needsRefresh()
														: null,
												List.copyOf(day.dependenciesIgnored())))
						.toList();
		List<TaskRowResponse> tasks =
				forecast.tasks().stream()
						.map(HorizonResponse::toTaskRow)
						.toList();
		return new HorizonResponse(
				forecast.currentDate(),
				forecast.currentTime(),
				assumptions,
				days,
				tasks);
	}

	private static TaskRowResponse toTaskRow(HorizonForecast.HorizonTaskRow row) {
		return new TaskRowResponse(
				row.taskId(),
				row.title(),
				row.status(),
				row.dueDate(),
				row.remainingEffortMinutes(),
				row.deadlineStatus(),
				row.projectedFinishDate(),
				row.waitingOn().stream()
						.map(ref -> new DependencyRef(ref.taskId(), ref.title()))
						.toList(),
				row.upstreamBlockers().stream()
						.map(ref -> new DependencyRef(ref.taskId(), ref.title()))
						.toList(),
				row.unresolvedEffort().stream()
						.map(ref -> new DependencyRef(ref.taskId(), ref.title()))
						.toList(),
				mergeSegments(row.segments()));
	}

	private static List<SegmentResponse> mergeSegments(List<HorizonSegment> segments) {
		Map<LocalDate, List<HorizonSegment>> byDate = new LinkedHashMap<>();
		for (HorizonSegment segment : segments) {
			byDate.computeIfAbsent(segment.date(), key -> new ArrayList<>()).add(segment);
		}
		List<SegmentResponse> merged = new ArrayList<>();
		for (Map.Entry<LocalDate, List<HorizonSegment>> entry : byDate.entrySet()) {
			LocalDate date = entry.getKey();
			List<HorizonSegment> daySegments = entry.getValue();
			int minutes = daySegments.stream().mapToInt(HorizonSegment::minutes).sum();
			Integer assumedCredit = sumAssumedCredits(daySegments);
			List<CreditExclusion> exclusions = unionExclusions(daySegments);
			UnplacedReason unplacedReason = null;
			Integer unplacedMinutes = null;
			UnplacedScope unplacedScope = null;
			for (HorizonSegment segment : daySegments) {
				if (segment.unplacedReason() != null) {
					unplacedReason = segment.unplacedReason();
					unplacedMinutes = segment.unplacedMinutes();
					unplacedScope = segment.unplacedScope();
					break;
				}
			}
			if (minutes == 0 && unplacedReason == null) {
				continue;
			}
			merged.add(
					new SegmentResponse(
							date,
							minutes,
							assumedCredit,
							exclusions,
							unplacedReason,
							unplacedMinutes,
							unplacedScope));
		}
		return merged;
	}

	private static Integer sumAssumedCredits(List<HorizonSegment> segments) {
		Integer sum = null;
		for (HorizonSegment segment : segments) {
			if (segment.assumedCreditMinutes() != null) {
				sum = (sum == null ? 0 : sum) + segment.assumedCreditMinutes();
			}
		}
		return sum;
	}

	private static List<CreditExclusion> unionExclusions(List<HorizonSegment> segments) {
		EnumSet<CreditExclusion> set = EnumSet.noneOf(CreditExclusion.class);
		for (HorizonSegment segment : segments) {
			set.addAll(segment.creditExclusions());
		}
		List<CreditExclusion> ordered = new ArrayList<>();
		if (set.contains(CreditExclusion.DEPENDENCY)) {
			ordered.add(CreditExclusion.DEPENDENCY);
		}
		if (set.contains(CreditExclusion.CHECKPOINT)) {
			ordered.add(CreditExclusion.CHECKPOINT);
		}
		return List.copyOf(ordered);
	}
}
