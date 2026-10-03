package com.focusflow.plan;

import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.ScheduledBlockResponse;
import com.focusflow.plan.dto.TaskSnapshotResponse;
import com.focusflow.plan.dto.UnplacedWorkResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.UnplacedReason;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanResponseMapper {

	public DailyPlanResponse toResponse(DailyPlan plan) {
		DailyPlanRevision revision = plan.getLatestRevision();
		List<DailyPlanBlock> sortedBlocks =
				revision.getBlocks().stream()
						.sorted(Comparator.comparingInt(DailyPlanBlock::getPosition))
						.toList();
		Map<DailyPlanTask, SessionProgress> sessionProgress = new HashMap<>();
		Map<DailyPlanTask, Integer> sessionCounts = computeSessionCounts(sortedBlocks);
		List<ScheduledBlockResponse> blocks =
				sortedBlocks.stream()
						.map(
								block ->
										toBlockResponse(
												block, sessionCounts, sessionProgress))
						.toList();
		List<UnplacedWorkResponse> unplacedWork =
				revision.getTasks().stream()
						.filter(task -> task.getUnplacedReason() != null)
						.sorted(Comparator.comparingInt(DailyPlanTask::getRank))
						.map(this::toUnplacedWorkResponse)
						.toList();
		return new DailyPlanResponse(
				plan.getId(),
				plan.getPlanDate(),
				plan.getCreatedAt(),
				plan.getWindowStart(),
				plan.getWindowEnd(),
				plan.getPeakStart(),
				plan.getPeakEnd(),
				revision.getFreeMinutes(),
				revision.getScheduledWorkMinutes(),
				revision.getRequiredMinutes(),
				revision.getRequestedBufferMinutes(),
				revision.getRealizedBufferMinutes(),
				deriveWarning(revision),
				blocks,
				unplacedWork);
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
		return new DailyPlanWarning(
				revision.getRequiredMinutes(),
				revision.getFreeMinutes(),
				revision.getScheduledWorkMinutes(),
				outOfTimeTasks,
				unestimatedTasks);
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
			DailyPlanBlock block,
			Map<DailyPlanTask, Integer> sessionCounts,
			Map<DailyPlanTask, SessionProgress> sessionProgress) {
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
					toTaskSnapshot(task),
					null);
		}
		return new ScheduledBlockResponse(
				block.getKind(),
				block.getStartTime(),
				block.getEndTime(),
				null,
				null,
				null,
				block.getLabel());
	}

	private UnplacedWorkResponse toUnplacedWorkResponse(DailyPlanTask task) {
		return new UnplacedWorkResponse(
				task.getUnplacedReason(), task.getUnplacedMinutes(), toTaskSnapshot(task));
	}

	private TaskSnapshotResponse toTaskSnapshot(DailyPlanTask task) {
		return new TaskSnapshotResponse(
				task.getSourceTaskId(),
				task.getTaskReferenceId(),
				task.getTaskTitle(),
				task.getTaskPriority(),
				task.getTaskStatus(),
				task.getTaskDueDate(),
				task.getTaskEstimatedMinutes(),
				task.isMustInclude());
	}

	private static final class SessionProgress {
		private int index;

		int nextIndex() {
			index++;
			return index;
		}
	}
}
