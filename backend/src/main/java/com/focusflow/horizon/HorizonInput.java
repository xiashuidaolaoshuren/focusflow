package com.focusflow.horizon;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

public record HorizonInput(
		LocalDate currentDate,
		LocalTime currentTime,
		EffectiveSchedulingPreferences preferences,
		List<HorizonTask> plannableTasks,
		List<HorizonTask> savedPlanOnlyTasks,
		List<DependencyLink> links,
		Map<Long, LatestCheckpoint> latestCheckpointByTaskId,
		Map<LocalDate, List<CommitmentWindow>> commitmentsByDate,
		List<SavedPlanDay> savedDays) {

	public record HorizonTask(
			long taskId,
			String title,
			TaskStatus status,
			TaskPriority priority,
			LocalDate dueDate,
			Integer remainingEffortMinutes) {}

	public record LatestCheckpoint(long checkpointId, LocalDate workDate) {}

	public record SavedPlanDay(
			LocalDate date,
			long planId,
			boolean needsRefresh,
			List<SavedSession> sessions,
			List<SavedUnplacedRow> unplacedRows) {}

	public record SavedSession(
			long sourceTaskId,
			LocalTime start,
			LocalTime end,
			boolean outcomeRecorded,
			boolean reconciled,
			boolean noLongerNeeded,
			Long capturedCheckpointId) {}

	public record SavedUnplacedRow(
			long sourceTaskId, UnplacedReason reason, Integer unplacedMinutes) {}
}
