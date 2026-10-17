package com.focusflow.plan;

import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.time.MinutePrecision;
import com.focusflow.horizon.HorizonForecast;
import com.focusflow.horizon.HorizonForecaster;
import com.focusflow.horizon.HorizonInput;
import com.focusflow.horizon.HorizonInput.HorizonTask;
import com.focusflow.horizon.HorizonInput.LatestCheckpoint;
import com.focusflow.horizon.HorizonInput.SavedPlanDay;
import com.focusflow.horizon.HorizonInput.SavedSession;
import com.focusflow.horizon.HorizonInput.SavedUnplacedRow;
import com.focusflow.plan.dto.HorizonResponse;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ComposedDay;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.RailSegment;
import com.focusflow.schedule.RevisionBlock;
import com.focusflow.schedule.RevisionView;
import com.focusflow.security.CurrentUser;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskService;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class HorizonService {

	private final CurrentUser currentUser;
	private final TaskQueryService taskQueryService;
	private final TaskService taskService;
	private final CommitmentQueryService commitmentQueryService;
	private final SchedulingPreferencesQueryService schedulingPreferencesQueryService;
	private final DailyPlanRepository dailyPlanRepository;

	public HorizonService(
			CurrentUser currentUser,
			TaskQueryService taskQueryService,
			TaskService taskService,
			CommitmentQueryService commitmentQueryService,
			SchedulingPreferencesQueryService schedulingPreferencesQueryService,
			DailyPlanRepository dailyPlanRepository) {
		this.currentUser = currentUser;
		this.taskQueryService = taskQueryService;
		this.taskService = taskService;
		this.commitmentQueryService = commitmentQueryService;
		this.schedulingPreferencesQueryService = schedulingPreferencesQueryService;
		this.dailyPlanRepository = dailyPlanRepository;
	}

	@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
	public HorizonResponse read(LocalDate currentDate, LocalTime currentTime) {
		requireParams(currentDate, currentTime);
		Long ownerId = currentUser.getCurrentUser().id();
		EffectiveSchedulingPreferences preferences =
				schedulingPreferencesQueryService.effectiveFor(ownerId);
		LocalDate spanEnd = spanEnd(currentDate, preferences.workingDays());

		List<Task> plannableTasks = taskQueryService.findPlannableTasksByOwnerId(ownerId);
		List<HorizonTask> plannableHorizonTasks =
				plannableTasks.stream().map(HorizonService::toHorizonTask).toList();
		Set<Long> plannableIds =
				plannableTasks.stream().map(Task::getId).collect(Collectors.toSet());

		Map<LocalDate, DailyPlan> savedPlansByDate =
				latestPlansByDate(
						dailyPlanRepository.findByOwner_IdAndPlanDateBetween(
								ownerId, currentDate, spanEnd));

		List<SavedPlanDay> savedDays = new ArrayList<>();
		Set<Long> savedOnlyTaskIds = new HashSet<>();
		for (Map.Entry<LocalDate, DailyPlan> entry : savedPlansByDate.entrySet()) {
			LocalDate planDate = entry.getKey();
			DailyPlan plan = entry.getValue();
			SavedPlanDay savedDay =
					toSavedPlanDay(plan, planDate, planDate.equals(currentDate));
			savedDays.add(savedDay);
			collectSavedTaskIds(savedDay, savedOnlyTaskIds);
		}
		savedOnlyTaskIds.removeAll(plannableIds);

		List<HorizonTask> savedPlanOnlyTasks =
				resolveSavedPlanOnlyTasks(ownerId, savedOnlyTaskIds, savedPlansByDate.values());

		Map<Long, LatestCheckpoint> checkpoints = new HashMap<>();
		for (Task task : plannableTasks) {
			taskService
					.latestCheckpointId(task)
					.flatMap(
							checkpointId ->
									taskService
											.latestCheckpointOrder(task)
											.map(
													order ->
															new LatestCheckpoint(
																	checkpointId, order.workDate())))
					.ifPresent(checkpoint -> checkpoints.put(task.getId(), checkpoint));
		}

		Map<LocalDate, List<CommitmentWindow>> commitmentsByDate = new LinkedHashMap<>();
		for (LocalDate date = currentDate; !date.isAfter(spanEnd); date = date.plusDays(1)) {
			if (!preferences.workingDays().contains(date.getDayOfWeek())) {
				continue;
			}
			if (savedPlansByDate.containsKey(date)) {
				continue;
			}
			commitmentsByDate.put(date, commitmentQueryService.windowsFor(ownerId, date));
		}

		HorizonInput input =
				new HorizonInput(
						currentDate,
						currentTime,
						preferences,
						plannableHorizonTasks,
						savedPlanOnlyTasks,
						taskQueryService.findLinksByOwnerId(ownerId),
						Map.copyOf(checkpoints),
						Map.copyOf(commitmentsByDate),
						List.copyOf(savedDays));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		return HorizonResponse.from(forecast, preferences.workingDays());
	}

	private static void requireParams(LocalDate currentDate, LocalTime currentTime) {
		if (currentDate == null) {
			throw new BadRequestException("currentDate is required");
		}
		if (currentTime == null) {
			throw new BadRequestException("currentTime is required");
		}
		MinutePrecision.requireMinuteAligned(currentTime);
	}

	private static LocalDate spanEnd(LocalDate currentDate, Set<java.time.DayOfWeek> workingDays) {
		List<LocalDate> workingDates = sevenWorkingDates(currentDate, workingDays);
		return workingDates.get(workingDates.size() - 1);
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

	private static Map<LocalDate, DailyPlan> latestPlansByDate(List<DailyPlan> plans) {
		Map<LocalDate, DailyPlan> latestByDate = new HashMap<>();
		for (DailyPlan plan : plans) {
			latestByDate.merge(plan.getPlanDate(), plan, HorizonService::newerPlan);
		}
		return latestByDate;
	}

	private static DailyPlan newerPlan(DailyPlan left, DailyPlan right) {
		int created = left.getCreatedAt().compareTo(right.getCreatedAt());
		if (created != 0) {
			return created >= 0 ? left : right;
		}
		return left.getId() >= right.getId() ? left : right;
	}

	private static void collectSavedTaskIds(SavedPlanDay savedDay, Set<Long> taskIds) {
		for (SavedSession session : savedDay.sessions()) {
			taskIds.add(session.sourceTaskId());
		}
		for (SavedUnplacedRow unplaced : savedDay.unplacedRows()) {
			taskIds.add(unplaced.sourceTaskId());
		}
	}

	private List<HorizonTask> resolveSavedPlanOnlyTasks(
			Long ownerId, Set<Long> savedOnlyTaskIds, Iterable<DailyPlan> savedPlans) {
		if (savedOnlyTaskIds.isEmpty()) {
			return List.of();
		}
		Map<Long, Task> liveById =
				taskQueryService.findOwnedTasksByIds(ownerId, savedOnlyTaskIds).stream()
						.collect(Collectors.toMap(Task::getId, task -> task));
		Map<Long, DailyPlanTask> snapshotByTaskId =
				mostRecentSnapshots(savedPlans, savedOnlyTaskIds);
		List<HorizonTask> rows = new ArrayList<>();
		for (Long taskId : savedOnlyTaskIds.stream().sorted().toList()) {
			Task live = liveById.get(taskId);
			if (live != null) {
				rows.add(toHorizonTask(live));
			} else {
				DailyPlanTask snapshot = snapshotByTaskId.get(taskId);
				if (snapshot != null) {
					rows.add(fromSnapshot(snapshot));
				}
			}
		}
		return rows;
	}

	private static Map<Long, DailyPlanTask> mostRecentSnapshots(
			Iterable<DailyPlan> savedPlans, Set<Long> taskIds) {
		Map<Long, DailyPlanTask> byTaskId = new HashMap<>();
		List<DailyPlan> ordered =
				new ArrayList<>();
		savedPlans.forEach(ordered::add);
		ordered.sort(Comparator.comparing(DailyPlan::getPlanDate).reversed());
		for (DailyPlan plan : ordered) {
			DailyPlanRevision revision = plan.getLatestRevision();
			for (DailyPlanTask planTask : revision.getTasks()) {
				long sourceTaskId = planTask.getSourceTaskId();
				if (taskIds.contains(sourceTaskId) && !byTaskId.containsKey(sourceTaskId)) {
					byTaskId.put(sourceTaskId, planTask);
				}
			}
		}
		return byTaskId;
	}

	private SavedPlanDay toSavedPlanDay(DailyPlan plan, LocalDate planDate, boolean composeToday) {
		List<SavedSession> sessions =
				composeToday
						? sessionsFromComposedRail(plan)
						: sessionsFromLatestRevision(plan);
		List<SavedUnplacedRow> unplaced = unplacedFromLatestRevision(plan);
		return new SavedPlanDay(
				planDate,
				plan.getId(),
				PlanFreshness.needsRefresh(plan),
				sessions,
				unplaced);
	}

	private static List<SavedUnplacedRow> unplacedFromLatestRevision(DailyPlan plan) {
		List<SavedUnplacedRow> rows = new ArrayList<>();
		for (DailyPlanTask task : plan.getLatestRevision().getTasks()) {
			if (task.getUnplacedReason() != null) {
				rows.add(
						new SavedUnplacedRow(
								task.getSourceTaskId(),
								task.getUnplacedReason(),
								task.getUnplacedMinutes()));
			}
		}
		return rows;
	}

	private static List<SavedSession> sessionsFromLatestRevision(DailyPlan plan) {
		DailyPlanRevision latest = plan.getLatestRevision();
		Map<Long, Long> checkpointByTaskId = checkpointIdsByTask(latest);
		List<SavedSession> sessions = new ArrayList<>();
		for (RevisionBlock block : PlanRevisionBlocks.fromRevision(latest)) {
			if (block.kind() != BlockKind.WORK || block.sourceTaskId() == null) {
				continue;
			}
			sessions.add(toSavedSession(block, checkpointByTaskId.get(block.sourceTaskId())));
		}
		sessions.sort(Comparator.comparing(SavedSession::start));
		return sessions;
	}

	private static List<SavedSession> sessionsFromComposedRail(DailyPlan plan) {
		List<RevisionView> revisionViews =
				plan.getRevisions().stream()
						.sorted(Comparator.comparingInt(DailyPlanRevision::getRevisionNumber))
						.map(
								revision ->
										new RevisionView(
												revision.getRevisionNumber(),
												revision.getCutoffTime(),
												PlanRevisionBlocks.fromRevision(revision)))
						.toList();
		ComposedDay composedDay = ComposedDay.compose(plan.getWindowStart(), revisionViews);
		Map<BlockKey, DailyPlanBlock> blockLookup = buildBlockLookup(plan);
		List<SavedSession> sessions = new ArrayList<>();
		for (RailSegment segment : composedDay.rail()) {
			if (segment.kind() != BlockKind.WORK || segment.sourceTaskId() == null) {
				continue;
			}
			DailyPlanBlock block =
					blockLookup.get(
							new BlockKey(
									segment.revisionNumber(),
									segment.kind(),
									segment.start(),
									segment.sourceTaskId(),
									segment.label()));
			if (block == null) {
				throw new IllegalStateException("composed rail segment has no source block");
			}
			Long capturedCheckpointId =
					block.getDailyPlanTask() != null
							? block.getDailyPlanTask().getCapturedCheckpointId()
							: null;
			sessions.add(
					new SavedSession(
							segment.sourceTaskId(),
							segment.start(),
							segment.end(),
							block.getOutcome() != null,
							block.isReconciled(),
							isNoLongerNeeded(block),
							capturedCheckpointId));
		}
		sessions.sort(Comparator.comparing(SavedSession::start));
		return sessions;
	}

	private static boolean isNoLongerNeeded(DailyPlanBlock block) {
		if (block.getKind() != BlockKind.WORK || block.getOutcome() != null) {
			return false;
		}
		DailyPlanTask planTask = block.getDailyPlanTask();
		Task task = planTask != null ? planTask.getTaskReference() : null;
		return task != null
				&& (task.getStatus() == com.focusflow.task.TaskStatus.DONE
						|| task.getStatus() == com.focusflow.task.TaskStatus.CANCELLED);
	}

	private static Map<Long, Long> checkpointIdsByTask(DailyPlanRevision revision) {
		Map<Long, Long> map = new HashMap<>();
		for (DailyPlanTask task : revision.getTasks()) {
			map.put(task.getSourceTaskId(), task.getCapturedCheckpointId());
		}
		return map;
	}

	private static SavedSession toSavedSession(RevisionBlock block, Long capturedCheckpointId) {
		return new SavedSession(
				block.sourceTaskId(),
				block.start(),
				block.end(),
				block.outcome() != null,
				block.reconciled(),
				block.noLongerNeeded(),
				capturedCheckpointId);
	}

	private static Map<BlockKey, DailyPlanBlock> buildBlockLookup(DailyPlan plan) {
		Map<BlockKey, DailyPlanBlock> lookup = new HashMap<>();
		for (DailyPlanRevision revision : plan.getRevisions()) {
			for (DailyPlanBlock block : revision.getBlocks()) {
				Long sourceTaskId =
						block.getDailyPlanTask() != null
								? block.getDailyPlanTask().getSourceTaskId()
								: null;
				lookup.put(
						new BlockKey(
								revision.getRevisionNumber(),
								block.getKind(),
								block.getStartTime(),
								sourceTaskId,
								block.getLabel()),
						block);
			}
		}
		return lookup;
	}

	private static HorizonTask toHorizonTask(Task task) {
		return new HorizonTask(
				task.getId(),
				task.getTitle(),
				task.getStatus(),
				task.getPriority(),
				task.getDueDate(),
				task.getRemainingEffortMinutes());
	}

	private static HorizonTask fromSnapshot(DailyPlanTask planTask) {
		Integer remaining = planTask.getCapturedRemainingEffortMinutes();
		if (remaining == null) {
			remaining = planTask.getTaskEstimatedMinutes();
		}
		return new HorizonTask(
				planTask.getSourceTaskId(),
				planTask.getTaskTitle(),
				planTask.getTaskStatus(),
				planTask.getTaskPriority(),
				planTask.getTaskDueDate(),
				remaining);
	}

	private record BlockKey(
			int revisionNumber,
			BlockKind kind,
			LocalTime start,
			Long sourceTaskId,
			String label) {}
}
