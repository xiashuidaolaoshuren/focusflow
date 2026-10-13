package com.focusflow.plan;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.InheritedRanking;
import com.focusflow.dependency.RankingCandidate;
import com.focusflow.effort.WorkOutcome;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.PlanRevisionResponse;
import com.focusflow.plan.dto.ScheduledBlockResponse;
import com.focusflow.plan.dto.TaskSnapshotResponse;
import com.focusflow.plan.dto.UnplacedWorkResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ComposedDay;
import com.focusflow.schedule.RailSegment;
import com.focusflow.schedule.RevisionBlock;
import com.focusflow.schedule.RevisionView;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskStatus;
import com.focusflow.task.UnplannedWork;
import com.focusflow.task.dto.UnplannedWorkResponse;
import java.time.LocalTime;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanResponseMapper {

	private final TaskQueryService taskQueryService;

	public DailyPlanResponseMapper(TaskQueryService taskQueryService) {
		this.taskQueryService = taskQueryService;
	}

	public DailyPlanResponse toResponse(DailyPlan plan) {
		DailyPlanRevision latestRevision = plan.getLatestRevision();
		List<PlanRevisionResponse> revisions = toRevisionResponses(plan);
		List<RevisionView> revisionViews = toRevisionViews(plan);
		ComposedDay composedDay = ComposedDay.compose(plan.getWindowStart(), revisionViews);
		Map<BlockKey, DailyPlanBlock> blockLookup = buildBlockLookup(plan);
		Map<Long, Long> neededForByTaskId =
				neededForByTaskId(latestRevision, plan.getPlanDate());
		List<ScheduledBlockResponse> composedRail =
				composedDay.rail().stream()
						.map(
								segment ->
										toComposedBlockResponse(
												plan, segment, blockLookup, neededForByTaskId))
						.toList();
		List<ScheduledBlockResponse> offRailEarlyCompletions =
				composedDay.offRailEarlyCompletions().stream()
						.map(
								revisionBlock ->
										toOffRailBlockResponse(
												plan, revisionBlock, blockLookup, neededForByTaskId))
						.toList();
		List<UnplannedWorkResponse> unplannedWork = toUnplannedWorkResponses(plan);
		int knownActualMinutes =
				composedDay.actuals().knownActualMinutes()
						+ unplannedWork.stream()
								.mapToInt(UnplannedWorkResponse::actualMinutes)
								.sum();

		List<DailyPlanBlock> sortedLatestBlocks =
				latestRevision.getBlocks().stream()
						.sorted(Comparator.comparingInt(DailyPlanBlock::getPosition))
						.toList();
		Map<DailyPlanTask, SessionProgress> sessionProgress = new HashMap<>();
		Map<DailyPlanTask, Integer> sessionCounts = computeSessionCounts(sortedLatestBlocks);
		List<ScheduledBlockResponse> blocks =
				sortedLatestBlocks.stream()
						.map(
								block ->
										toBlockResponse(
												plan,
												block,
												sessionCounts,
												sessionProgress,
												neededForByTaskId))
						.toList();
		List<UnplacedWorkResponse> unplacedWork =
				latestRevision.getTasks().stream()
						.filter(task -> task.getUnplacedReason() != null)
						.sorted(Comparator.comparingInt(DailyPlanTask::getRank))
						.map(
								task ->
										toUnplacedWorkResponse(
												latestRevision, task, neededForByTaskId))
						.toList();

		return new DailyPlanResponse(
				plan.getId(),
				plan.getPlanDate(),
				plan.getCreatedAt(),
				plan.getWindowStart(),
				plan.getWindowEnd(),
				plan.getPeakStart(),
				plan.getPeakEnd(),
				latestRevision.getFreeMinutes(),
				latestRevision.getScheduledWorkMinutes(),
				latestRevision.getRequiredMinutes(),
				latestRevision.getRequestedBufferMinutes(),
				latestRevision.getRealizedBufferMinutes(),
				deriveWarning(latestRevision),
				blocks,
				unplacedWork,
				PlanFreshness.needsRefresh(plan),
				knownActualMinutes,
				composedDay.actuals().missingActualCount(),
				revisions,
				composedRail,
				offRailEarlyCompletions,
				unplannedWork);
	}

	private List<PlanRevisionResponse> toRevisionResponses(DailyPlan plan) {
		return plan.getRevisions().stream()
				.sorted(Comparator.comparingInt(DailyPlanRevision::getRevisionNumber))
				.map(revision -> toPlanRevisionResponse(plan, revision))
				.toList();
	}

	private PlanRevisionResponse toPlanRevisionResponse(
			DailyPlan plan, DailyPlanRevision revision) {
		List<DailyPlanBlock> sortedBlocks =
				revision.getBlocks().stream()
						.sorted(Comparator.comparingInt(DailyPlanBlock::getPosition))
						.toList();
		Map<DailyPlanTask, SessionProgress> sessionProgress = new HashMap<>();
		Map<DailyPlanTask, Integer> sessionCounts = computeSessionCounts(sortedBlocks);
		Map<Long, Long> neededForByTaskId = neededForByTaskId(revision, plan.getPlanDate());
		List<ScheduledBlockResponse> blocks =
				sortedBlocks.stream()
						.map(
								block ->
										toBlockResponse(
												plan,
												block,
												sessionCounts,
												sessionProgress,
												neededForByTaskId))
						.toList();
		List<UnplacedWorkResponse> unplacedWork =
				revision.getTasks().stream()
						.filter(task -> task.getUnplacedReason() != null)
						.sorted(Comparator.comparingInt(DailyPlanTask::getRank))
						.map(
								task ->
										toUnplacedWorkResponse(
												revision, task, neededForByTaskId))
						.toList();
		return new PlanRevisionResponse(
				revision.getId(),
				revision.getRevisionNumber(),
				revision.getCutoffTime(),
				revision.getFreeMinutes(),
				revision.getScheduledWorkMinutes(),
				revision.getRequiredMinutes(),
				revision.getRequestedBufferMinutes(),
				revision.getRealizedBufferMinutes(),
				blocks,
				unplacedWork);
	}

	private List<RevisionView> toRevisionViews(DailyPlan plan) {
		return plan.getRevisions().stream()
				.sorted(Comparator.comparingInt(DailyPlanRevision::getRevisionNumber))
				.map(
						revision ->
								new RevisionView(
										revision.getRevisionNumber(),
										revision.getCutoffTime(),
										PlanRevisionBlocks.fromRevision(revision)))
				.toList();
	}

	private Map<BlockKey, DailyPlanBlock> buildBlockLookup(DailyPlan plan) {
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

	private ScheduledBlockResponse toComposedBlockResponse(
			DailyPlan plan,
			RailSegment segment,
			Map<BlockKey, DailyPlanBlock> blockLookup,
			Map<Long, Long> neededForByTaskId) {
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
		WorkOutcome outcome =
				block.getOutcome() != null ? WorkOutcome.valueOf(block.getOutcome()) : null;
		BlockDisplayState displayState = BlockDisplayState.of(plan, block);
		Long revisionId = block.getRevision() != null ? block.getRevision().getId() : null;
		if (segment.kind() == BlockKind.WORK) {
			return new ScheduledBlockResponse(
					segment.kind(),
					segment.start(),
					segment.end(),
					segment.sessionIndex(),
					segment.sessionCount(),
					toTaskSnapshot(block.getDailyPlanTask(), neededForByTaskId),
					null,
					block.getId(),
					revisionId,
					outcome,
					segment.actualMinutes() != null ? segment.actualMinutes() : block.getActualMinutes(),
					block.isReconciled(),
					block.getProgressVersion(),
					displayState);
		}
		return new ScheduledBlockResponse(
				segment.kind(),
				segment.start(),
				segment.end(),
				null,
				null,
				null,
				segment.label(),
				block.getId(),
				revisionId,
				outcome,
				block.getActualMinutes(),
				block.isReconciled(),
				block.getProgressVersion(),
				displayState);
	}

	private ScheduledBlockResponse toOffRailBlockResponse(
			DailyPlan plan,
			RevisionBlock revisionBlock,
			Map<BlockKey, DailyPlanBlock> blockLookup,
			Map<Long, Long> neededForByTaskId) {
		DailyPlanBlock block =
				blockLookup.get(
						new BlockKey(
								revisionBlock.revisionNumber(),
								revisionBlock.kind(),
								revisionBlock.start(),
								revisionBlock.sourceTaskId(),
								revisionBlock.label()));
		if (block == null) {
			throw new IllegalStateException("off-rail block has no source block");
		}
		Map<DailyPlanTask, Integer> sessionCounts =
				computeSessionCounts(List.of(block));
		Map<DailyPlanTask, SessionProgress> sessionProgress = new HashMap<>();
		return toBlockResponse(
				plan, block, sessionCounts, sessionProgress, neededForByTaskId);
	}

	private List<UnplannedWorkResponse> toUnplannedWorkResponses(DailyPlan plan) {
		Long ownerId = plan.getOwner() != null ? plan.getOwner().getId() : null;
		if (ownerId == null) {
			return List.of();
		}
		return taskQueryService
				.findUnplannedWorkByOwnerIdAndWorkDate(ownerId, plan.getPlanDate())
				.stream()
				.sorted(Comparator.comparing(UnplannedWork::getRecordedAt))
				.map(this::toUnplannedWorkResponse)
				.toList();
	}

	private UnplannedWorkResponse toUnplannedWorkResponse(UnplannedWork entry) {
		return new UnplannedWorkResponse(
				entry.getId(),
				entry.getSourceTaskId(),
				entry.getTaskReference() != null ? entry.getTaskReference().getId() : null,
				entry.getWorkDate(),
				entry.getActualMinutes(),
				entry.getRecordedAt());
	}

	private DailyPlanWarning deriveWarning(DailyPlanRevision revision) {
		List<DailyPlanTask> mustIncludeUnplaced =
				revision.getTasks().stream()
						.filter(PlanMustIncludeRules::isShortfallContributor)
						.toList();
		if (mustIncludeUnplaced.isEmpty()) {
			return null;
		}
		List<DailyPlanWarning.OutOfTimeTask> outOfTimeTasks =
				mustIncludeUnplaced.stream()
						.filter(task -> task.getUnplacedReason() == UnplacedReason.OUT_OF_TIME)
						.map(
								task ->
										new DailyPlanWarning.OutOfTimeTask(
												task.getSourceTaskId(),
												task.getTaskTitle(),
												task.getUnplacedMinutes() != null
														? task.getUnplacedMinutes()
														: 0))
						.toList();
		List<DailyPlanWarning.UnestimatedTask> unestimatedTasks =
				mustIncludeUnplaced.stream()
						.filter(task -> task.getUnplacedReason() == UnplacedReason.NO_ESTIMATE)
						.map(
								task ->
										new DailyPlanWarning.UnestimatedTask(
												task.getSourceTaskId(), task.getTaskTitle()))
						.toList();
		List<DailyPlanWarning.BlockedTask> blockedTasks =
				revision.getTasks().stream()
						.filter(
								task ->
										task.isMustInclude()
												&& task.getUnplacedReason() == UnplacedReason.BLOCKED)
						.map(
								task ->
										new DailyPlanWarning.BlockedTask(
												task.getSourceTaskId(),
												task.getTaskTitle(),
												blockerSourceTaskIds(revision, task.getSourceTaskId())))
						.toList();
		return new DailyPlanWarning(
				revision.getRequiredMinutes(),
				revision.getFreeMinutes(),
				revision.getScheduledWorkMinutes(),
				outOfTimeTasks,
				unestimatedTasks,
				blockedTasks);
	}

	private static List<Long> blockerSourceTaskIds(DailyPlanRevision revision, long blockedId) {
		return revision.getDependencies().stream()
				.filter(dep -> dep.getBlockedSourceTaskId() == blockedId)
				.map(DailyPlanRevisionDependency::getBlockerSourceTaskId)
				.sorted()
				.toList();
	}

	private static Map<Long, Long> neededForByTaskId(
			DailyPlanRevision revision, LocalDate planDate) {
		List<RankingCandidate> candidates =
				revision.getTasks().stream()
						.map(
								task ->
										new RankingCandidate(
												task.getSourceTaskId(),
												task.getTaskStatus(),
												task.getTaskDueDate()))
						.toList();
		List<DependencyLink> links = snapshotLinks(revision);
		Map<Long, Long> neededFor = new HashMap<>();
		for (InheritedAssignment assignment :
				InheritedRanking.assign(candidates, links, planDate, Set.of())) {
			if (assignment.neededForTaskId() != assignment.taskId()) {
				neededFor.put(assignment.taskId(), assignment.neededForTaskId());
			}
		}
		return neededFor;
	}

	private static List<DependencyLink> snapshotLinks(DailyPlanRevision revision) {
		return revision.getDependencies().stream()
				.map(
						dep ->
								new DependencyLink(
										dep.getBlockerSourceTaskId(),
										dep.getBlockedSourceTaskId(),
										snapshotBlockerPlannable(
												revision, dep.getBlockerSourceTaskId())))
				.toList();
	}

	private static boolean snapshotBlockerPlannable(
			DailyPlanRevision revision, long blockerSourceTaskId) {
		return revision.getTasks().stream()
				.filter(task -> task.getSourceTaskId() == blockerSourceTaskId)
				.findFirst()
				.map(DailyPlanResponseMapper::isPlannableStatus)
				.orElse(false);
	}

	private static boolean isPlannableStatus(DailyPlanTask task) {
		TaskStatus status = task.getTaskStatus();
		return status == TaskStatus.OPEN || status == TaskStatus.IN_PROGRESS;
	}

	private Map<DailyPlanTask, Integer> computeSessionCounts(List<DailyPlanBlock> blocks) {
		Map<DailyPlanTask, Integer> sessionCounts = new HashMap<>();
		for (DailyPlanBlock block : blocks) {
			if (block.getKind() == BlockKind.WORK && block.getDailyPlanTask() != null) {
				sessionCounts.merge(block.getDailyPlanTask(), 1, Integer::sum);
			}
		}
		return sessionCounts;
	}

	private ScheduledBlockResponse toBlockResponse(
			DailyPlan plan,
			DailyPlanBlock block,
			Map<DailyPlanTask, Integer> sessionCounts,
			Map<DailyPlanTask, SessionProgress> sessionProgress,
			Map<Long, Long> neededForByTaskId) {
		Long revisionId = block.getRevision() != null ? block.getRevision().getId() : null;
		WorkOutcome outcome =
				block.getOutcome() != null ? WorkOutcome.valueOf(block.getOutcome()) : null;
		BlockDisplayState displayState = BlockDisplayState.of(plan, block);
		if (block.getKind() == BlockKind.WORK) {
			DailyPlanTask task = block.getDailyPlanTask();
			SessionProgress progress =
					sessionProgress.computeIfAbsent(task, ignored -> new SessionProgress());
			int sessionIndex = progress.nextIndex();
			int sessionCount = sessionCounts.getOrDefault(task, 0);
			return new ScheduledBlockResponse(
					block.getKind(),
					block.getStartTime(),
					block.getEndTime(),
					sessionIndex,
					sessionCount,
					toTaskSnapshot(task, neededForByTaskId),
					null,
					block.getId(),
					revisionId,
					outcome,
					block.getActualMinutes(),
					block.isReconciled(),
					block.getProgressVersion(),
					displayState);
		}
		return new ScheduledBlockResponse(
				block.getKind(),
				block.getStartTime(),
				block.getEndTime(),
				null,
				null,
				null,
				block.getLabel(),
				block.getId(),
				revisionId,
				outcome,
				block.getActualMinutes(),
				block.isReconciled(),
				block.getProgressVersion(),
				displayState);
	}

	private UnplacedWorkResponse toUnplacedWorkResponse(
			DailyPlanRevision revision,
			DailyPlanTask task,
			Map<Long, Long> neededForByTaskId) {
		List<Long> blockerSourceTaskIds =
				task.getUnplacedReason() == UnplacedReason.BLOCKED
						? blockerSourceTaskIds(revision, task.getSourceTaskId())
						: List.of();
		return new UnplacedWorkResponse(
				task.getUnplacedReason(),
				task.getUnplacedMinutes(),
				toTaskSnapshot(task, neededForByTaskId),
				blockerSourceTaskIds);
	}

	private TaskSnapshotResponse toTaskSnapshot(
			DailyPlanTask task, Map<Long, Long> neededForByTaskId) {
		if (task == null) {
			return null;
		}
		return new TaskSnapshotResponse(
				task.getSourceTaskId(),
				task.getTaskReferenceId(),
				task.getTaskTitle(),
				task.getTaskPriority(),
				task.getTaskStatus(),
				task.getTaskDueDate(),
				task.getTaskEstimatedMinutes(),
				task.getCapturedRemainingEffortMinutes(),
				task.isMustInclude(),
				task.getCapturedCheckpointId(),
				neededForByTaskId.get(task.getSourceTaskId()));
	}

	private record BlockKey(
			int revisionNumber,
			BlockKind kind,
			LocalTime start,
			Long sourceTaskId,
			String label) {}

	private static final class SessionProgress {
		private int index;

		int nextIndex() {
			index++;
			return index;
		}
	}
}
