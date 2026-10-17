package com.focusflow.plan;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.common.error.ConflictException;
import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.TaskEffortVersion;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.FixedBreakWindow;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.schedule.UnplacedWork;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DailyPlanPersister {

	private final OwnerSchedulingLock ownerSchedulingLock;
	private final TaskQueryService taskQueryService;
	private final DailyPlanRepository dailyPlanRepository;
	private final DailyPlanResponseMapper responseMapper;

	public DailyPlanPersister(
			OwnerSchedulingLock ownerSchedulingLock,
			TaskQueryService taskQueryService,
			DailyPlanRepository dailyPlanRepository,
			DailyPlanResponseMapper responseMapper) {
		this.ownerSchedulingLock = ownerSchedulingLock;
		this.taskQueryService = taskQueryService;
		this.dailyPlanRepository = dailyPlanRepository;
		this.responseMapper = responseMapper;
	}

	@Transactional
	public DailyPlanResponse persistPlan(
			Long ownerId,
			LocalDate planDate,
			Long replacePlanId,
			List<AiPlanItem> aiItems,
			List<Task> capturedTasks,
			DailyPlanSchedule schedule,
			PlanDependencyCapture capture) {
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Optional<DailyPlan> latestPlan =
				dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						ownerId, planDate);
		PlanReplacePreconditions.validateReplacePrecondition(latestPlan, replacePlanId);
		latestPlan.ifPresent(
				existing -> {
					dailyPlanRepository.delete(existing);
					dailyPlanRepository.flush();
				});

		List<Long> selectedTaskIds = aiItems.stream().map(AiPlanItem::taskId).toList();
		List<Task> reloadedTasks = taskQueryService.findOwnedTasksByIds(ownerId, selectedTaskIds);
		Map<Long, Task> taskById =
				reloadedTasks.stream()
						.collect(
								Collectors.toMap(
										task -> task.getId() != null ? task.getId() : 0L,
										Function.identity(),
										(first, second) -> first));
		for (AiPlanItem aiItem : aiItems) {
			if (!taskById.containsKey(aiItem.taskId())) {
				throw new ConflictException(
						"TASK_MISSING_DURING_GENERATION",
						"a selected task is no longer available");
			}
		}

		Map<Long, Task> capturedById =
				capturedTasks.stream()
						.collect(
								Collectors.toMap(
										task -> task.getId() != null ? task.getId() : 0L,
										Function.identity(),
										(first, second) -> first));
		DailyPlan plan =
				buildPlan(owner, planDate, aiItems, capturedById, taskById, schedule, capture);
		dailyPlanRepository.save(plan);
		dailyPlanRepository.flush();

		DailyPlanRevision revision = plan.getLatestRevision();
		Map<Long, DailyPlanTask> planTaskBySourceId =
				revision.getTasks().stream()
						.collect(
								Collectors.toMap(
										DailyPlanTask::getSourceTaskId,
										Function.identity(),
										(first, second) -> first));
		int position = 1;
		for (ScheduledBlock block : schedule.blocks()) {
			DailyPlanBlock planBlock = new DailyPlanBlock();
			planBlock.setKind(block.kind());
			planBlock.setStartTime(block.start());
			planBlock.setEndTime(block.end());
			planBlock.setLabel(block.label());
			planBlock.setPosition(position++);
			if (block.kind() == BlockKind.WORK && block.sourceTaskId() != null) {
				planBlock.setDailyPlanTask(planTaskBySourceId.get(block.sourceTaskId()));
			}
			revision.addBlock(planBlock);
		}
		return responseMapper.toResponse(dailyPlanRepository.saveAndFlush(plan));
	}

	private DailyPlan buildPlan(
			User owner,
			LocalDate planDate,
			List<AiPlanItem> aiItems,
			Map<Long, Task> capturedById,
			Map<Long, Task> taskById,
			DailyPlanSchedule schedule,
			PlanDependencyCapture capture) {
		Instant createdAt = Instant.now();
		DailyPlan plan = new DailyPlan();
		plan.setOwner(owner);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(createdAt);
		plan.setWindowStart(schedule.windowStart());
		plan.setWindowEnd(schedule.windowEnd());
		plan.setPeakStart(schedule.peakStart());
		plan.setPeakEnd(schedule.peakEnd());
		plan.setCadenceEnabled(schedule.cadenceEnabled());
		plan.setTargetFocusMinutes(schedule.targetFocusMinutes());
		plan.setBreakMinutes(schedule.breakMinutes());
		plan.setMinSessionMinutes(schedule.minSessionMinutes());
		plan.setBufferMinutes(schedule.bufferMinutes());
		for (FixedBreakWindow fixedBreak : schedule.fixedBreaks()) {
			PlanFixedBreakSnapshot snapshot = new PlanFixedBreakSnapshot();
			snapshot.setLabel(fixedBreak.label());
			snapshot.setStartTime(fixedBreak.start());
			snapshot.setEndTime(fixedBreak.end());
			plan.addFixedBreakSnapshot(snapshot);
		}

		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		revision.setFreeMinutes(schedule.freeMinutes());
		revision.setScheduledWorkMinutes(schedule.scheduledWorkMinutes());
		revision.setRequiredMinutes(schedule.requiredMinutes());
		revision.setRequestedBufferMinutes(schedule.requestedBufferMinutes());
		revision.setRealizedBufferMinutes(schedule.realizedBufferMinutes());
		revision.setCreatedAt(createdAt);

		Map<Long, UnplacedWork> unplacedBySourceId =
				schedule.unplacedWork().stream()
						.collect(
								Collectors.toMap(
										UnplacedWork::sourceTaskId,
										Function.identity(),
										(first, second) -> first));

		Map<Long, RankingGroup> groupByTaskId = groupByTaskId(capture);
		Set<Long> candidateIds = new HashSet<>(capturedById.keySet());
		for (AiPlanItem aiItem : aiItems) {
			Task captured = capturedById.get(aiItem.taskId());
			Task reference = taskById.get(aiItem.taskId());
			long sourceTaskId = captured.getId() != null ? captured.getId() : 0L;
			DailyPlanTask planTask = new DailyPlanTask();
			planTask.setRank(aiItem.position());
			planTask.setSourceTaskId(sourceTaskId);
			planTask.setTaskReference(reference);
			planTask.setTaskTitle(captured.getTitle());
			planTask.setTaskPriority(captured.getPriority());
			planTask.setTaskStatus(captured.getStatus());
			planTask.setTaskDueDate(captured.getDueDate());
			planTask.setTaskEstimatedMinutes(captured.getEstimatedMinutes());
			planTask.setCapturedRemainingEffortMinutes(captured.getRemainingEffortMinutes());
			RankingGroup group = groupByTaskId.getOrDefault(sourceTaskId, RankingGroup.OPTIONAL);
			planTask.setMustInclude(PlanMustIncludeRules.isInheritedMustInclude(group));
			planTask.setCapturedCheckpointId(capture.checkpointIdByTaskId().get(sourceTaskId));
			UnplacedWork unplaced = unplacedBySourceId.get(planTask.getSourceTaskId());
			if (unplaced != null) {
				planTask.setUnplacedReason(unplaced.reason());
				planTask.setUnplacedMinutes(unplaced.unplacedMinutes());
			}
			revision.addTask(planTask);
		}
		addDependencySnapshots(revision, capture.links(), candidateIds);

		plan.addRevision(revision);
		return plan;
	}

	@Transactional
	public DailyPlanResponse appendRevision(
			Long planId,
			Long expectedRevisionId,
			List<TaskEffortVersion> effortVersions,
			LocalTime effectiveCutoff,
			List<AiPlanItem> aiItems,
			List<Task> capturedTasks,
			DailyPlanSchedule schedule,
			PlanDependencyCapture capture) {
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Long ownerId = owner.getId();
		DailyPlan plan =
				dailyPlanRepository
						.findByOwner_IdAndId(ownerId, planId)
						.orElseThrow(() -> new NotFoundException("daily plan not found"));
		DailyPlanRevision latestRevision = plan.getLatestRevision();
		List<Task> plannableTasks = taskQueryService.findPlannableTasksByOwnerId(ownerId);
		PlanReplanFreshness.validate(
				expectedRevisionId, effortVersions, latestRevision, plannableTasks);
		Set<Long> candidateIds = candidateIdsFrom(capturedTasks);
		validateCapturedLinksUnchanged(ownerId, capture.links(), candidateIds);

		List<Long> selectedTaskIds = aiItems.stream().map(AiPlanItem::taskId).toList();
		List<Task> reloadedTasks = taskQueryService.findOwnedTasksByIds(ownerId, selectedTaskIds);
		Map<Long, Task> taskById =
				reloadedTasks.stream()
						.collect(
								Collectors.toMap(
										task -> task.getId() != null ? task.getId() : 0L,
										Function.identity(),
										(first, second) -> first));
		for (AiPlanItem aiItem : aiItems) {
			if (!taskById.containsKey(aiItem.taskId())) {
				throw new ConflictException("PLAN_CHANGED", "candidate set has changed");
			}
		}

		Map<Long, Task> capturedById = new HashMap<>();
		for (Task captured : capturedTasks) {
			capturedById.put(captured.getId() != null ? captured.getId() : 0L, captured);
		}

		DailyPlanRevision revision =
				buildAppendedRevision(
						plan,
						effectiveCutoff,
						aiItems,
						capturedById,
						taskById,
						schedule,
						capture);
		plan.addRevision(revision);
		dailyPlanRepository.saveAndFlush(plan);

		// Persist the revision and its task snapshots first, then read them back so the
		// blocks reference rows that already exist. The kind-shape constraint rejects a
		// WORK block whose task is null, and Hibernate does not order a nullable
		// association's insert ahead of its target.
		DailyPlan persisted =
				dailyPlanRepository.findByOwner_IdAndId(ownerId, planId).orElseThrow();
		DailyPlanRevision appended = persisted.getLatestRevision();
		Map<Long, DailyPlanTask> planTaskBySourceId =
				appended.getTasks().stream()
						.collect(
								Collectors.toMap(
										DailyPlanTask::getSourceTaskId,
										Function.identity(),
										(first, second) -> first));
		int position = 1;
		for (ScheduledBlock block : schedule.blocks()) {
			DailyPlanBlock planBlock = new DailyPlanBlock();
			planBlock.setKind(block.kind());
			planBlock.setStartTime(block.start());
			planBlock.setEndTime(block.end());
			planBlock.setLabel(block.label());
			planBlock.setPosition(position++);
			if (block.kind() == BlockKind.WORK && block.sourceTaskId() != null) {
				planBlock.setDailyPlanTask(planTaskBySourceId.get(block.sourceTaskId()));
			}
			appended.addBlock(planBlock);
		}
		return responseMapper.toResponse(dailyPlanRepository.saveAndFlush(persisted));
	}

	private DailyPlanRevision buildAppendedRevision(
			DailyPlan plan,
			LocalTime effectiveCutoff,
			List<AiPlanItem> aiItems,
			Map<Long, Task> capturedById,
			Map<Long, Task> taskById,
			DailyPlanSchedule schedule,
			PlanDependencyCapture capture) {
		Instant createdAt = Instant.now();
		int nextRevisionNumber = plan.getLatestRevision().getRevisionNumber() + 1;
		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(nextRevisionNumber);
		revision.setCutoffTime(effectiveCutoff);
		revision.setFreeMinutes(schedule.freeMinutes());
		revision.setScheduledWorkMinutes(schedule.scheduledWorkMinutes());
		revision.setRequiredMinutes(schedule.requiredMinutes());
		revision.setRequestedBufferMinutes(schedule.requestedBufferMinutes());
		revision.setRealizedBufferMinutes(schedule.realizedBufferMinutes());
		revision.setCreatedAt(createdAt);

		Map<Long, UnplacedWork> unplacedBySourceId =
				schedule.unplacedWork().stream()
						.collect(
								Collectors.toMap(
										UnplacedWork::sourceTaskId,
										Function.identity(),
										(first, second) -> first));

		Map<Long, RankingGroup> groupByTaskId = groupByTaskId(capture);
		Set<Long> candidateIds = new HashSet<>(capturedById.keySet());
		for (AiPlanItem aiItem : aiItems) {
			Task reference = taskById.get(aiItem.taskId());
			Task captured = capturedById.getOrDefault(aiItem.taskId(), reference);
			long sourceTaskId = reference.getId() != null ? reference.getId() : 0L;
			DailyPlanTask planTask = new DailyPlanTask();
			planTask.setRank(aiItem.position());
			planTask.setSourceTaskId(sourceTaskId);
			planTask.setTaskReference(reference);
			planTask.setTaskTitle(captured.getTitle());
			planTask.setTaskPriority(captured.getPriority());
			planTask.setTaskStatus(captured.getStatus());
			planTask.setTaskDueDate(captured.getDueDate());
			planTask.setTaskEstimatedMinutes(captured.getEstimatedMinutes());
			planTask.setCapturedRemainingEffortMinutes(reference.getRemainingEffortMinutes());
			RankingGroup group = groupByTaskId.getOrDefault(sourceTaskId, RankingGroup.OPTIONAL);
			planTask.setMustInclude(PlanMustIncludeRules.isInheritedMustInclude(group));
			planTask.setCapturedCheckpointId(capture.checkpointIdByTaskId().get(sourceTaskId));
			UnplacedWork unplaced = unplacedBySourceId.get(planTask.getSourceTaskId());
			if (unplaced != null) {
				planTask.setUnplacedReason(unplaced.reason());
				planTask.setUnplacedMinutes(unplaced.unplacedMinutes());
			}
			revision.addTask(planTask);
		}
		addDependencySnapshots(revision, capture.links(), candidateIds);

		return revision;
	}

	private static Map<Long, RankingGroup> groupByTaskId(PlanDependencyCapture capture) {
		Map<Long, RankingGroup> groups = new HashMap<>();
		for (InheritedAssignment assignment : capture.assignments()) {
			groups.put(assignment.taskId(), assignment.group());
		}
		return groups;
	}

	private static Set<Long> candidateIdsFrom(List<Task> capturedTasks) {
		Set<Long> candidateIds = new HashSet<>();
		for (Task task : capturedTasks) {
			candidateIds.add(task.getId() != null ? task.getId() : 0L);
		}
		return candidateIds;
	}

	private void validateCapturedLinksUnchanged(
			Long ownerId, List<DependencyLink> capturedLinks, Set<Long> candidateIds) {
		Set<DependencyPair> capturedPairs = activeCandidatePairs(capturedLinks, candidateIds);
		Set<DependencyPair> livePairs =
				activeCandidatePairs(
						taskQueryService.findLinksByOwnerId(ownerId), candidateIds);
		if (!capturedPairs.equals(livePairs)) {
			throw new ConflictException("PLAN_CHANGED", "dependency links changed");
		}
	}

	private static void addDependencySnapshots(
			DailyPlanRevision revision, List<DependencyLink> links, Set<Long> candidateIds) {
		for (DependencyLink link : links) {
			if (!link.blockerPlannable()) {
				continue;
			}
			if (!candidateIds.contains(link.blockerId()) || !candidateIds.contains(link.blockedId())) {
				continue;
			}
			DailyPlanRevisionDependency dependency = new DailyPlanRevisionDependency();
			dependency.setBlockedSourceTaskId(link.blockedId());
			dependency.setBlockerSourceTaskId(link.blockerId());
			revision.addDependency(dependency);
		}
	}

	private static Set<DependencyPair> activeCandidatePairs(
			List<DependencyLink> links, Set<Long> candidateIds) {
		Set<DependencyPair> pairs = new HashSet<>();
		for (DependencyLink link : links) {
			if (!link.blockerPlannable()) {
				continue;
			}
			if (candidateIds.contains(link.blockerId()) && candidateIds.contains(link.blockedId())) {
				pairs.add(new DependencyPair(link.blockerId(), link.blockedId()));
			}
		}
		return pairs;
	}

	private record DependencyPair(long blockerId, long blockedId) {}
}
