package com.focusflow.horizon;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.DependencyOrderRepair;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.InheritedRanking;
import com.focusflow.dependency.RankingCandidate;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.horizon.HorizonForecast.CreditExclusion;
import com.focusflow.horizon.HorizonForecast.DeadlineStatus;
import com.focusflow.horizon.HorizonForecast.HorizonSegment;
import com.focusflow.horizon.HorizonForecast.TaskRef;
import com.focusflow.horizon.HorizonForecast.UnplacedScope;
import com.focusflow.horizon.HorizonInput.HorizonTask;
import com.focusflow.horizon.HorizonInput.LatestCheckpoint;
import com.focusflow.horizon.HorizonInput.SavedPlanDay;
import com.focusflow.horizon.HorizonInput.SavedSession;
import com.focusflow.horizon.HorizonInput.SavedUnplacedRow;
import com.focusflow.preferences.EffectiveFixedBreak;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
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
import com.focusflow.schedule.TaskDependencyEdge;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.schedule.UnplacedWork;
import com.focusflow.schedule.WorkPlacementPlanner;
import com.focusflow.schedule.WorkWindow;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

public final class HorizonForecaster {

	private HorizonForecaster() {}

	public static HorizonForecast forecast(HorizonInput input) {
		Map<LocalDate, SavedPlanDay> savedByDate = indexSavedDays(input.savedDays());
		List<LocalDate> workingDates =
				sevenWorkingDates(input.currentDate(), input.preferences().workingDays());
		LocalDate spanEnd = workingDates.get(workingDates.size() - 1);
		List<ColumnPlan> columnPlans = buildColumnPlans(input, spanEnd, savedByDate);

		Map<Long, HorizonTask> taskById = indexTasks(input);
		Map<Long, Integer> runningRemainder = initialRemainders(input.plannableTasks());
		Map<Long, Integer> startingRemainder = new HashMap<>(runningRemainder);
		Map<Long, List<HorizonSegment>> segmentsByTask = new HashMap<>();
		Map<Long, Integer> assumedCreditBeforeColumn = new HashMap<>();
		Map<Long, Integer> forecastPlacedBeforeColumn = new HashMap<>();
		Map<Long, LocalDate> projectedFinish = new HashMap<>();
		Map<LocalDate, Map<Long, Integer>> remainderAfterColumn = new HashMap<>();

		LocalDate firstWorkingDay = firstWorkingDayInSpan(columnPlans, input.preferences().workingDays());
		List<Long> rowOrderFromFirstWorkingDay = null;

		List<HorizonForecast.HorizonDay> outputDays = new ArrayList<>();

		for (ColumnPlan column : columnPlans) {
			snapshotBeforeColumn(
					input.plannableTasks(),
					assumedCreditBeforeColumn,
					forecastPlacedBeforeColumn,
					segmentsByTask);

			if (column.saved() != null) {
				List<Long> ignored =
						processSavedDay(
								column.date(),
								column.saved(),
								input,
								taskById,
								runningRemainder,
								startingRemainder,
								segmentsByTask,
								assumedCreditBeforeColumn,
								projectedFinish);
				outputDays.add(toHorizonDay(column.saved(), ignored));
			} else {
				ForecastOrder order =
						computeForecastOrder(
								input,
								column.date(),
								assumedCreditBeforeColumn,
								forecastPlacedBeforeColumn,
								runningRemainder);
				if (column.date().equals(firstWorkingDay)) {
				 rowOrderFromFirstWorkingDay = List.copyOf(order.orderedTaskIds());
				}
				applyForecastDay(
						input,
						column.date(),
						order,
						runningRemainder,
						segmentsByTask,
						projectedFinish);
				outputDays.add(
						new HorizonForecast.HorizonDay(
								column.date(),
								HorizonForecast.DayKind.FORECAST,
								null,
								false,
								List.of()));
			}
			remainderAfterColumn.put(column.date(), copyRemainders(runningRemainder));
		}

		LocalDate lastColumn = columnPlans.get(columnPlans.size() - 1).date();
		List<HorizonForecast.HorizonTaskRow> rows =
				assembleRows(
						input,
						taskById,
						rowOrderFromFirstWorkingDay,
						segmentsByTask,
						runningRemainder,
						projectedFinish,
						columnPlans,
						lastColumn,
						remainderAfterColumn,
						input.currentDate());

		return new HorizonForecast(
				input.currentDate(), input.currentTime(), outputDays, rows);
	}

	private record ColumnPlan(LocalDate date, SavedPlanDay saved) {}

	private record ForecastOrder(List<Long> orderedTaskIds, Map<Long, RankingGroup> groups) {}

	private static Map<LocalDate, SavedPlanDay> indexSavedDays(List<SavedPlanDay> savedDays) {
		Map<LocalDate, SavedPlanDay> byDate = new HashMap<>();
		for (SavedPlanDay savedDay : savedDays) {
			byDate.put(savedDay.date(), savedDay);
		}
		return byDate;
	}

	private static List<ColumnPlan> buildColumnPlans(
			HorizonInput input,
			LocalDate spanEnd,
			Map<LocalDate, SavedPlanDay> savedByDate) {
		Set<java.time.DayOfWeek> workingDays = input.preferences().workingDays();
		List<ColumnPlan> columns = new ArrayList<>();
		for (LocalDate date = input.currentDate(); !date.isAfter(spanEnd); date = date.plusDays(1)) {
			SavedPlanDay saved = savedByDate.get(date);
			boolean isWorking = workingDays.contains(date.getDayOfWeek());
			if (!isWorking && saved == null) {
				continue;
			}
			columns.add(new ColumnPlan(date, saved));
		}
		return columns;
	}

	private static List<LocalDate> sevenWorkingDates(
			LocalDate start, Set<java.time.DayOfWeek> workingDays) {
		List<LocalDate> found = new ArrayList<>();
		LocalDate cursor = start;
		while (found.size() < 7) {
			if (workingDays.contains(cursor.getDayOfWeek())) {
				found.add(cursor);
			}
			cursor = cursor.plusDays(1);
		}
		return found;
	}

	private static LocalDate firstWorkingDayInSpan(
			List<ColumnPlan> columns, Set<java.time.DayOfWeek> workingDays) {
		for (ColumnPlan column : columns) {
			if (workingDays.contains(column.date().getDayOfWeek())) {
				return column.date();
			}
		}
		throw new IllegalStateException("span has no working day");
	}

	private static Map<Long, HorizonTask> indexTasks(HorizonInput input) {
		Map<Long, HorizonTask> byId = new LinkedHashMap<>();
		for (HorizonTask task : input.plannableTasks()) {
			byId.put(task.taskId(), task);
		}
		for (HorizonTask task : input.savedPlanOnlyTasks()) {
			byId.putIfAbsent(task.taskId(), task);
		}
		return byId;
	}

	private static Map<Long, Integer> initialRemainders(List<HorizonTask> plannableTasks) {
		Map<Long, Integer> remainders = new HashMap<>();
		for (HorizonTask task : plannableTasks) {
			if (task.remainingEffortMinutes() != null) {
				remainders.put(task.taskId(), task.remainingEffortMinutes());
			}
		}
		return remainders;
	}

	private static Map<Long, Integer> copyRemainders(Map<Long, Integer> runningRemainder) {
		return new HashMap<>(runningRemainder);
	}

	private static void snapshotBeforeColumn(
			List<HorizonTask> plannableTasks,
			Map<Long, Integer> assumedCreditBeforeColumn,
			Map<Long, Integer> forecastPlacedBeforeColumn,
			Map<Long, List<HorizonSegment>> segmentsByTask) {
		assumedCreditBeforeColumn.clear();
		forecastPlacedBeforeColumn.clear();
		for (HorizonTask task : plannableTasks) {
			long id = task.taskId();
			assumedCreditBeforeColumn.put(id, totalAssumedCredit(segmentsByTask.get(id)));
			forecastPlacedBeforeColumn.put(id, totalForecastMinutes(segmentsByTask.get(id)));
		}
	}

	private static int totalAssumedCredit(List<HorizonSegment> segments) {
		if (segments == null) {
			return 0;
		}
		int total = 0;
		for (HorizonSegment segment : segments) {
			if (segment.assumedCreditMinutes() != null) {
				total += segment.assumedCreditMinutes();
			}
		}
		return total;
	}

	private static int totalForecastMinutes(List<HorizonSegment> segments) {
		if (segments == null) {
			return 0;
		}
		int total = 0;
		for (HorizonSegment segment : segments) {
			if (segment.unplacedScope() == UnplacedScope.FORECAST && segment.minutes() > 0) {
				total += segment.minutes();
			}
		}
		return total;
	}

	private static HorizonForecast.HorizonDay toHorizonDay(
			SavedPlanDay saved, List<Long> dependenciesIgnored) {
		return new HorizonForecast.HorizonDay(
				saved.date(),
				HorizonForecast.DayKind.SAVED,
				saved.planId(),
				saved.needsRefresh(),
				List.copyOf(dependenciesIgnored));
	}

	private static List<Long> processSavedDay(
			LocalDate date,
			SavedPlanDay saved,
			HorizonInput input,
			Map<Long, HorizonTask> taskById,
			Map<Long, Integer> runningRemainder,
			Map<Long, Integer> startingRemainder,
			Map<Long, List<HorizonSegment>> segmentsByTask,
			Map<Long, Integer> assumedCreditBeforeColumn,
			Map<Long, LocalDate> projectedFinish) {
		List<SavedSession> sessions = new ArrayList<>(saved.sessions());
		sessions.sort(Comparator.comparing(SavedSession::start));
		List<SavedSession> priorSessions = new ArrayList<>();
		List<Long> dependenciesIgnored = new ArrayList<>();

		for (SavedSession session : sessions) {
			int minutes = minutesBetween(session.start(), session.end());
			HorizonTask task = taskById.get(session.sourceTaskId());
			List<CreditExclusion> exclusions = new ArrayList<>();
			Integer assumedCredit = null;

			if (task != null && isPlannable(task.status()) && !sessionConsumesNothing(session)) {
				if (!checkpointEligible(
						date,
						session,
						input.latestCheckpointByTaskId().get(session.sourceTaskId()))) {
					exclusions.add(CreditExclusion.CHECKPOINT);
				} else if (!blockerSatisfiedAt(
						session.sourceTaskId(),
						session.start(),
						input,
						startingRemainder,
						assumedCreditBeforeColumn,
						priorSessions,
						taskById)) {
					exclusions.add(CreditExclusion.DEPENDENCY);
					if (!dependenciesIgnored.contains(session.sourceTaskId())) {
						dependenciesIgnored.add(session.sourceTaskId());
					}
				} else {
					Integer remainder = runningRemainder.get(session.sourceTaskId());
					if (remainder != null && remainder > 0) {
						assumedCredit = Math.min(minutes, remainder);
						int next = remainder - assumedCredit;
						runningRemainder.put(session.sourceTaskId(), next);
						if (next == 0 && !projectedFinish.containsKey(session.sourceTaskId())) {
							projectedFinish.put(session.sourceTaskId(), date);
						}
					}
				}
			}

			addSegment(
					segmentsByTask,
					session.sourceTaskId(),
					new HorizonSegment(
							date,
							minutes,
							assumedCredit,
							List.copyOf(exclusions),
							null,
							null,
							null));

			priorSessions.add(session);
		}

		for (SavedUnplacedRow unplaced : saved.unplacedRows()) {
			addSegment(
					segmentsByTask,
					unplaced.sourceTaskId(),
					new HorizonSegment(
							date,
							0,
							null,
							List.of(),
							unplaced.reason(),
							unplaced.unplacedMinutes(),
							UnplacedScope.SAVED_SHORTFALL));
		}

		return dependenciesIgnored;
	}

	private static boolean sessionConsumesNothing(SavedSession session) {
		return session.outcomeRecorded() || session.reconciled() || session.noLongerNeeded();
	}

	private static boolean checkpointEligible(
			LocalDate planDate, SavedSession session, LatestCheckpoint latest) {
		if (latest == null) {
			return true;
		}
		if (planDate.isAfter(latest.workDate())) {
			return true;
		}
		if (planDate.isBefore(latest.workDate())) {
			return false;
		}
		return session.capturedCheckpointId() != null
				&& session.capturedCheckpointId().longValue() == latest.checkpointId();
	}

	private static boolean blockerSatisfiedAt(
			long taskId,
			LocalTime sessionStart,
			HorizonInput input,
			Map<Long, Integer> startingRemainder,
			Map<Long, Integer> assumedCreditBeforeColumn,
			List<SavedSession> priorSessions,
			Map<Long, HorizonTask> taskById) {
		for (DependencyLink link : input.links()) {
			if (!link.blockerPlannable() || link.blockedId() != taskId) {
				continue;
			}
			long blockerId = link.blockerId();
			if (!isBlockerSatisfied(
					blockerId,
					sessionStart,
					startingRemainder,
					assumedCreditBeforeColumn,
					priorSessions,
					taskById)) {
				return false;
			}
		}
		return true;
	}

	private static boolean isBlockerSatisfied(
			long blockerId,
			LocalTime beforeStart,
			Map<Long, Integer> startingRemainder,
			Map<Long, Integer> assumedCreditBeforeColumn,
			List<SavedSession> priorSessions,
			Map<Long, HorizonTask> taskById) {
		HorizonTask blocker = taskById.get(blockerId);
		if (blocker == null || !isPlannable(blocker.status())) {
			return true;
		}
		if (blocker.remainingEffortMinutes() == null) {
			return false;
		}
		Integer startRemainder = startingRemainder.get(blockerId);
		if (startRemainder == null) {
			return true;
		}
		int credited =
				assumedCreditBeforeColumn.getOrDefault(blockerId, 0)
						+ sameDayMinutesEndingBefore(blockerId, beforeStart, priorSessions);
		return credited >= startRemainder;
	}

	private static int sameDayMinutesEndingBefore(
			long blockerId, LocalTime beforeStart, List<SavedSession> priorSessions) {
		int total = 0;
		for (SavedSession session : priorSessions) {
			if (session.sourceTaskId() != blockerId || sessionConsumesNothing(session)) {
				continue;
			}
			if (!session.end().isAfter(beforeStart)) {
				total += minutesBetween(session.start(), session.end());
			} else if (session.start().isBefore(beforeStart)) {
				total += minutesBetween(session.start(), beforeStart);
			}
		}
		return total;
	}

	private static ForecastOrder computeForecastOrder(
			HorizonInput input,
			LocalDate dayDate,
			Map<Long, Integer> assumedCreditBeforeColumn,
			Map<Long, Integer> forecastPlacedBeforeColumn,
			Map<Long, Integer> runningRemainder) {
		Set<Long> mustContinue = new HashSet<>();
		for (HorizonTask task : input.plannableTasks()) {
			long id = task.taskId();
			if (task.status() == TaskStatus.IN_PROGRESS) {
				mustContinue.add(id);
			}
			if (assumedCreditBeforeColumn.getOrDefault(id, 0) > 0
					|| forecastPlacedBeforeColumn.getOrDefault(id, 0) > 0) {
				mustContinue.add(id);
			}
		}

		List<RankingCandidate> candidates = new ArrayList<>();
		for (HorizonTask task : input.plannableTasks()) {
			long id = task.taskId();
			if (task.remainingEffortMinutes() == null) {
				candidates.add(
						new RankingCandidate(id, task.status(), task.dueDate()));
				continue;
			}
			Integer remainder = runningRemainder.get(id);
			if (remainder != null && remainder > 0) {
				candidates.add(
						new RankingCandidate(id, task.status(), task.dueDate()));
			}
		}

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(
						candidates, input.links(), dayDate, mustContinue);
		Map<Long, InheritedAssignment> byId = new HashMap<>();
		Map<Long, RankingGroup> groups = new HashMap<>();
		for (InheritedAssignment assignment : assignments) {
			byId.put(assignment.taskId(), assignment);
			groups.put(assignment.taskId(), assignment.group());
		}

		Map<Long, HorizonTask> taskById =
				input.plannableTasks().stream()
						.collect(Collectors.toMap(HorizonTask::taskId, t -> t));

		List<Long> sorted =
				candidates.stream()
						.map(RankingCandidate::taskId)
						.sorted(
								Comparator.comparing(
												(Long id) -> groups.get(id),
												Comparator.comparingInt(RankingGroup::ordinal))
										.thenComparing(
												(Long id) ->
														byId.get(id).inheritedDueDate(),
												Comparator.nullsLast(Comparator.naturalOrder()))
										.thenComparing(
												(Long id) ->
														priorityOrder(taskById.get(id).priority()))
										.thenComparingLong(id -> id))
						.toList();

		List<Long> repaired =
				DependencyOrderRepair.repair(sorted, input.links(), groups);
		return new ForecastOrder(repaired, groups);
	}

	private static int priorityOrder(TaskPriority priority) {
		return switch (priority) {
			case HIGH -> 0;
			case MEDIUM -> 1;
			case LOW -> 2;
		};
	}

	private static void applyForecastDay(
			HorizonInput input,
			LocalDate dayDate,
			ForecastOrder order,
			Map<Long, Integer> runningRemainder,
			Map<Long, List<HorizonSegment>> segmentsByTask,
			Map<Long, LocalDate> projectedFinish) {
		EffectiveSchedulingPreferences preferences = input.preferences();
		LocalTime windowStart = preferences.workDayStart();
		LocalTime windowEnd = preferences.workDayEnd();
		if (dayDate.equals(input.currentDate())) {
			LocalTime current = input.currentTime();
			if (!current.isBefore(windowEnd)) {
				return;
			}
			windowStart = current.isAfter(windowStart) ? current : windowStart;
		}
		if (!windowStart.isBefore(windowEnd)) {
			return;
		}

		WorkWindow window = new WorkWindow(windowStart, windowEnd);
		List<FixedBreakWindow> fixedBreaks =
				preferences.fixedBreaks().stream()
						.map(HorizonForecaster::toFixedBreak)
						.toList();
		List<CommitmentWindow> commitments =
				input.commitmentsByDate().getOrDefault(dayDate, List.of());

		FreeIntervalPlan stage1 =
				FreeIntervalPlanner.plan(
						window,
						fixedBreaks,
						commitments,
						preferences.bufferMinutes());
		PlacementPolicy policy =
				new PlacementPolicy(
						preferences.cadenceEnabled(),
						preferences.targetFocusMinutes(),
						preferences.breakMinutes(),
						preferences.minSessionMinutes());

		Set<Long> offered = new HashSet<>(order.orderedTaskIds());
		List<RankedTask> ranking = new ArrayList<>();
		for (long taskId : order.orderedTaskIds()) {
			HorizonTask task =
					input.plannableTasks().stream()
							.filter(t -> t.taskId() == taskId)
							.findFirst()
							.orElseThrow();
			Integer remainder = runningRemainder.get(taskId);
			if (remainder != null && remainder <= 0) {
				continue;
			}
			ranking.add(new RankedTask(taskId, remainder));
		}
		if (ranking.isEmpty()) {
			return;
		}

		List<TaskDependencyEdge> edges =
				input.links().stream()
						.filter(
								link ->
										link.blockerPlannable()
												&& offered.contains(link.blockerId())
												&& offered.contains(link.blockedId()))
						.map(link -> new TaskDependencyEdge(link.blockerId(), link.blockedId()))
						.toList();

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, policy, edges);
		SchedulePostconditionValidator.validate(window, stage1, ranking, edges, result);

		for (ScheduledBlock block : result.blocks()) {
			if (block.kind() != BlockKind.WORK || block.sourceTaskId() == null) {
				continue;
			}
			long taskId = block.sourceTaskId();
			int minutes = minutesBetween(block.start(), block.end());
			addSegment(
					segmentsByTask,
					taskId,
					new HorizonSegment(
							dayDate,
							minutes,
							null,
							List.of(),
							null,
							null,
							UnplacedScope.FORECAST));
			Integer remainder = runningRemainder.get(taskId);
			if (remainder != null && remainder > 0) {
				int placed = Math.min(minutes, remainder);
				int next = remainder - placed;
				runningRemainder.put(taskId, next);
				if (next == 0 && !projectedFinish.containsKey(taskId)) {
					projectedFinish.put(taskId, dayDate);
				}
			}
		}

		for (UnplacedWork unplaced : result.unplacedWork()) {
			addSegment(
					segmentsByTask,
					unplaced.sourceTaskId(),
					new HorizonSegment(
							dayDate,
							0,
							null,
							List.of(),
							unplaced.reason(),
							unplaced.unplacedMinutes(),
							UnplacedScope.FORECAST));
		}

	}

	private static FixedBreakWindow toFixedBreak(EffectiveFixedBreak fixedBreak) {
		return new FixedBreakWindow(
				fixedBreak.label(), fixedBreak.startTime(), fixedBreak.endTime());
	}

	private static void addSegment(
			Map<Long, List<HorizonSegment>> segmentsByTask,
			long taskId,
			HorizonSegment segment) {
		segmentsByTask.computeIfAbsent(taskId, ignored -> new ArrayList<>()).add(segment);
	}

	private static List<HorizonForecast.HorizonTaskRow> assembleRows(
			HorizonInput input,
			Map<Long, HorizonTask> taskById,
			List<Long> rowOrderFromFirstWorkingDay,
			Map<Long, List<HorizonSegment>> segmentsByTask,
			Map<Long, Integer> runningRemainder,
			Map<Long, LocalDate> projectedFinish,
			List<ColumnPlan> columnPlans,
			LocalDate lastColumn,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			LocalDate currentDate) {
		List<HorizonForecast.HorizonTaskRow> rows = new ArrayList<>();
		Set<Long> plannableIds =
				input.plannableTasks().stream().map(HorizonTask::taskId).collect(Collectors.toSet());

		if (rowOrderFromFirstWorkingDay != null) {
			for (long taskId : rowOrderFromFirstWorkingDay) {
				HorizonTask task = taskById.get(taskId);
				if (task != null && plannableIds.contains(taskId)) {
					rows.add(
							buildRow(
									task,
									segmentsByTask.getOrDefault(taskId, List.of()),
									input,
									taskById,
									columnPlans,
									lastColumn,
									remainderAfterColumn,
									currentDate,
									projectedFinish.get(taskId)));
				}
			}
		}

		List<HorizonTask> savedOnly =
				input.savedPlanOnlyTasks().stream()
						.sorted(
								Comparator.comparing(HorizonTask::title)
										.thenComparingLong(HorizonTask::taskId))
						.toList();
		for (HorizonTask task : savedOnly) {
			if (plannableIds.contains(task.taskId())) {
				continue;
			}
			rows.add(
					buildRow(
							task,
							segmentsByTask.getOrDefault(task.taskId(), List.of()),
							input,
							taskById,
							columnPlans,
							lastColumn,
							remainderAfterColumn,
							currentDate,
							projectedFinish.get(task.taskId())));
		}

		for (HorizonTask task : input.plannableTasks()) {
			if (rows.stream().anyMatch(row -> row.taskId() == task.taskId())) {
				continue;
			}
			rows.add(
					buildRow(
							task,
							segmentsByTask.getOrDefault(task.taskId(), List.of()),
							input,
							taskById,
							columnPlans,
							lastColumn,
							remainderAfterColumn,
							currentDate,
							projectedFinish.get(task.taskId())));
		}

		return rows;
	}

	private static HorizonForecast.HorizonTaskRow buildRow(
			HorizonTask task,
			List<HorizonSegment> segments,
			HorizonInput input,
			Map<Long, HorizonTask> taskById,
			List<ColumnPlan> columnPlans,
			LocalDate lastColumn,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			LocalDate currentDate,
			LocalDate projectedFinishDate) {
		DeadlineStatus status = null;
		List<TaskRef> waitingOn = List.of();
		List<TaskRef> upstreamBlockers = List.of();
		List<TaskRef> unresolvedEffort = List.of();

		if (isPlannable(task.status()) && task.dueDate() != null) {
			status =
					computeDeadlineStatus(
							task,
							input,
							taskById,
							columnPlans,
							lastColumn,
							remainderAfterColumn,
							currentDate);
			if (status != DeadlineStatus.ON_TRACK) {
				LocalDate reference = deadlineReference(task.dueDate(), lastColumn);
				DependencyLists lists =
						computeDependencyLists(
								task.taskId(),
								reference,
								input,
								taskById,
								remainderAfterColumn,
								columnPlans,
								currentDate);
				waitingOn = lists.waitingOn();
				upstreamBlockers = lists.upstreamBlockers();
				unresolvedEffort = lists.unresolvedEffort();
			}
		}

		return new HorizonForecast.HorizonTaskRow(
				task.taskId(),
				task.title(),
				task.status(),
				task.dueDate(),
				task.remainingEffortMinutes(),
				status,
				projectedFinishDate,
				waitingOn,
				upstreamBlockers,
				unresolvedEffort,
				List.copyOf(segments));
	}

	private static LocalDate deadlineReference(LocalDate dueDate, LocalDate lastColumn) {
		return dueDate.isAfter(lastColumn) ? lastColumn : dueDate;
	}

	private static DeadlineStatus computeDeadlineStatus(
			HorizonTask task,
			HorizonInput input,
			Map<Long, HorizonTask> taskById,
			List<ColumnPlan> columnPlans,
			LocalDate lastColumn,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			LocalDate currentDate) {
		LocalDate due = task.dueDate();
		if (due.isBefore(currentDate)) {
			return DeadlineStatus.OVERDUE;
		}
		if (hasUnknownEffortInActiveChain(task.taskId(), input, taskById)) {
			return DeadlineStatus.CANNOT_FORECAST;
		}
		LocalDate reference = deadlineReference(due, lastColumn);
		if (remainderZeroOnOrBefore(task.taskId(), reference, remainderAfterColumn, columnPlans)) {
			return DeadlineStatus.ON_TRACK;
		}
		if (!due.isAfter(lastColumn)) {
			return DeadlineStatus.AT_RISK;
		}
		return DeadlineStatus.BEYOND_HORIZON;
	}

	private static boolean remainderZeroOnOrBefore(
			long taskId,
			LocalDate reference,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			List<ColumnPlan> columnPlans) {
		LocalDate last = null;
		for (ColumnPlan column : columnPlans) {
			if (column.date().isAfter(reference)) {
				break;
			}
			last = column.date();
		}
		if (last == null) {
			return false;
		}
		Map<Long, Integer> snapshot = remainderAfterColumn.get(last);
		if (snapshot == null) {
			return false;
		}
		Integer remainder = snapshot.get(taskId);
		return remainder != null && remainder == 0;
	}

	private static boolean hasUnknownEffortInActiveChain(
			long taskId, HorizonInput input, Map<Long, HorizonTask> taskById) {
		Set<Long> chain = activeChain(taskId, input.links(), taskById);
		for (long id : chain) {
			HorizonTask member = taskById.get(id);
			if (member != null && member.remainingEffortMinutes() == null) {
				return true;
			}
		}
		return false;
	}

	private record DependencyLists(
			List<TaskRef> waitingOn,
			List<TaskRef> upstreamBlockers,
			List<TaskRef> unresolvedEffort) {}

	private static DependencyLists computeDependencyLists(
			long taskId,
			LocalDate reference,
			HorizonInput input,
			Map<Long, HorizonTask> taskById,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			List<ColumnPlan> columnPlans,
			LocalDate currentDate) {
		List<TaskRef> waitingOn = new ArrayList<>();
		Set<Long> directBlockers = new HashSet<>();
		for (DependencyLink link : input.links()) {
			if (!link.blockerPlannable() || link.blockedId() != taskId) {
				continue;
			}
			long blockerId = link.blockerId();
			directBlockers.add(blockerId);
			if (isUnfinishedAtReference(
					blockerId,
					reference,
					currentDate,
					remainderAfterColumn,
					columnPlans,
					taskById)) {
				HorizonTask blocker = taskById.get(blockerId);
				if (blocker != null) {
					waitingOn.add(new TaskRef(blockerId, blocker.title()));
				}
			}
		}

		Set<Long> chain = activeChain(taskId, input.links(), taskById);
		List<TaskRef> upstream = new ArrayList<>();
		List<TaskRef> unresolved = new ArrayList<>();
		for (long id : chain) {
			HorizonTask member = taskById.get(id);
			if (member == null) {
				continue;
			}
			if (member.remainingEffortMinutes() == null) {
				unresolved.add(new TaskRef(id, member.title()));
			}
			if (directBlockers.contains(id)) {
				continue;
			}
			if (isUnfinishedAtReference(
							id,
							reference,
							currentDate,
							remainderAfterColumn,
							columnPlans,
							taskById)
					|| member.remainingEffortMinutes() == null) {
				upstream.add(new TaskRef(id, member.title()));
			}
		}

		return new DependencyLists(
				List.copyOf(waitingOn), List.copyOf(upstream), List.copyOf(unresolved));
	}

	private static boolean isUnfinishedAtReference(
			long taskId,
			LocalDate reference,
			LocalDate currentDate,
			Map<LocalDate, Map<Long, Integer>> remainderAfterColumn,
			List<ColumnPlan> columnPlans,
			Map<Long, HorizonTask> taskById) {
		if (reference.isBefore(currentDate)) {
			return true;
		}
		HorizonTask task = taskById.get(taskId);
		if (task == null || !isPlannable(task.status())) {
			return false;
		}
		if (task.remainingEffortMinutes() == null) {
			return true;
		}
		LocalDate last = null;
		for (ColumnPlan column : columnPlans) {
			if (column.date().isAfter(reference)) {
				break;
			}
			last = column.date();
		}
		if (last == null) {
			return true;
		}
		Map<Long, Integer> snapshot = remainderAfterColumn.get(last);
		if (snapshot == null) {
			return true;
		}
		Integer remainder = snapshot.get(taskId);
		return remainder == null || remainder > 0;
	}

	private static Set<Long> activeChain(
			long startTaskId, List<DependencyLink> links, Map<Long, HorizonTask> taskById) {
		Set<Long> chain = new HashSet<>();
		collectChain(startTaskId, links, taskById, chain);
		return chain;
	}

	private static void collectChain(
			long taskId,
			List<DependencyLink> links,
			Map<Long, HorizonTask> taskById,
			Set<Long> chain) {
		if (!chain.add(taskId)) {
			return;
		}
		for (DependencyLink link : links) {
			if (!link.blockerPlannable() || link.blockedId() != taskId) {
				continue;
			}
			collectChain(link.blockerId(), links, taskById, chain);
		}
	}

	private static boolean isPlannable(TaskStatus status) {
		return status == TaskStatus.OPEN || status == TaskStatus.IN_PROGRESS;
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}
}
