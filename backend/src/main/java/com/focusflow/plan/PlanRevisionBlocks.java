package com.focusflow.plan;

import com.focusflow.effort.WorkOutcome;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.RevisionBlock;
import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import java.util.ArrayList;
import java.util.List;

final class PlanRevisionBlocks {

	private PlanRevisionBlocks() {}

	static List<RevisionBlock> fromRevision(DailyPlanRevision revision) {
		List<RevisionBlock> blocks = new ArrayList<>();
		for (DailyPlanBlock block : revision.getBlocks()) {
			blocks.add(toRevisionBlock(revision, block));
		}
		return blocks;
	}

	private static RevisionBlock toRevisionBlock(DailyPlanRevision revision, DailyPlanBlock block) {
		Long sourceTaskId = null;
		if (block.getDailyPlanTask() != null) {
			sourceTaskId = block.getDailyPlanTask().getSourceTaskId();
		}
		WorkOutcome outcome =
				block.getOutcome() != null ? WorkOutcome.valueOf(block.getOutcome()) : null;
		return new RevisionBlock(
				revision.getRevisionNumber(),
				block.getKind(),
				block.getStartTime(),
				block.getEndTime(),
				sourceTaskId,
				block.getLabel(),
				outcome,
				block.getActualMinutes(),
				block.isReconciled(),
				isNoLongerNeeded(block));
	}

	private static boolean isNoLongerNeeded(DailyPlanBlock block) {
		if (block.getKind() != BlockKind.WORK || block.getOutcome() != null) {
			return false;
		}
		DailyPlanTask planTask = block.getDailyPlanTask();
		Task task = planTask != null ? planTask.getTaskReference() : null;
		return task != null
				&& (task.getStatus() == TaskStatus.DONE
						|| task.getStatus() == TaskStatus.CANCELLED);
	}
}
