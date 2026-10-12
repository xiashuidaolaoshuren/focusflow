package com.focusflow.testsupport;

import com.focusflow.plan.DailyPlan;
import com.focusflow.plan.DailyPlanBlock;
import com.focusflow.plan.DailyPlanRevision;
import com.focusflow.plan.DailyPlanTask;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.Task;
import com.focusflow.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/** Fluent builder for {@link DailyPlan} with revision-scoped tasks and blocks in tests. */
public final class DailyPlanTestBuilder {

	private final User owner;
	private final LocalDate planDate;
	private Instant createdAt = Instant.parse("1970-01-01T00:00:00Z");
	private LocalTime windowStart = LocalTime.of(9, 0);
	private LocalTime windowEnd = LocalTime.of(18, 0);
	private LocalTime peakStart;
	private LocalTime peakEnd;
	private int freeMinutes;
	private int scheduledWorkMinutes;
	private long requiredMinutes;
	private int requestedBufferMinutes;
	private int realizedBufferMinutes;
	private final List<TaskSpec> tasks = new ArrayList<>();
	private final List<BlockSpec> blocks = new ArrayList<>();
	private final List<DailyPlanTask> builtTasks = new ArrayList<>();

	private DailyPlanTestBuilder(User owner, LocalDate planDate) {
		this.owner = owner;
		this.planDate = planDate;
	}

	public static DailyPlanTestBuilder plan(User owner, LocalDate planDate) {
		return new DailyPlanTestBuilder(owner, planDate);
	}

	public DailyPlanTestBuilder withCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
		return this;
	}

	public DailyPlanTestBuilder withWindow(LocalTime start, LocalTime end) {
		this.windowStart = start;
		this.windowEnd = end;
		return this;
	}

	public DailyPlanTestBuilder withPeak(LocalTime start, LocalTime end) {
		this.peakStart = start;
		this.peakEnd = end;
		return this;
	}

	public DailyPlanTestBuilder withMetrics(
			int freeMinutes,
			int scheduledWorkMinutes,
			long requiredMinutes,
			int requestedBufferMinutes,
			int realizedBufferMinutes) {
		this.freeMinutes = freeMinutes;
		this.scheduledWorkMinutes = scheduledWorkMinutes;
		this.requiredMinutes = requiredMinutes;
		this.requestedBufferMinutes = requestedBufferMinutes;
		this.realizedBufferMinutes = realizedBufferMinutes;
		return this;
	}

	public DailyPlanTestBuilder addTask(
			Task task,
			int rank,
			boolean mustInclude,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes) {
		tasks.add(new TaskSpec(task, rank, mustInclude, unplacedReason, unplacedMinutes));
		return this;
	}

	public DailyPlanTestBuilder addBlock(
			int taskIndex,
			BlockKind kind,
			LocalTime start,
			LocalTime end,
			String label,
			int position) {
		blocks.add(new BlockSpec(taskIndex, kind, start, end, label, position));
		return this;
	}

	public DailyPlan build() {
		DailyPlan plan = buildTasksOnly();
		attachBlocksTo(plan);
		return plan;
	}

	public DailyPlan buildTasksOnly() {
		DailyPlan plan = new DailyPlan();
		plan.setOwner(owner);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(createdAt);
		plan.setWindowStart(windowStart);
		plan.setWindowEnd(windowEnd);
		plan.setPeakStart(peakStart);
		plan.setPeakEnd(peakEnd);

		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(1);
		revision.setFreeMinutes(freeMinutes);
		revision.setScheduledWorkMinutes(scheduledWorkMinutes);
		revision.setRequiredMinutes(requiredMinutes);
		revision.setRequestedBufferMinutes(requestedBufferMinutes);
		revision.setRealizedBufferMinutes(realizedBufferMinutes);
		revision.setCreatedAt(createdAt);

		List<DailyPlanTask> built = new ArrayList<>();
		for (TaskSpec spec : tasks) {
			DailyPlanTask planTask = new DailyPlanTask();
			planTask.setRank(spec.rank);
			planTask.setSourceTaskId(spec.task.getId() != null ? spec.task.getId() : 0L);
			planTask.setTaskReference(spec.task);
			planTask.setTaskTitle(spec.task.getTitle());
			planTask.setTaskPriority(spec.task.getPriority());
			planTask.setTaskStatus(spec.task.getStatus());
			planTask.setTaskDueDate(spec.task.getDueDate());
			planTask.setTaskEstimatedMinutes(spec.task.getEstimatedMinutes());
			planTask.setMustInclude(spec.mustInclude);
			planTask.setUnplacedReason(spec.unplacedReason);
			planTask.setUnplacedMinutes(spec.unplacedMinutes);
			revision.addTask(planTask);
			built.add(planTask);
		}
		plan.addRevision(revision);
		builtTasks.clear();
		builtTasks.addAll(built);
		return plan;
	}

	public void attachBlocksTo(DailyPlan plan) {
		DailyPlanRevision revision = plan.getLatestRevision();
		for (BlockSpec spec : blocks) {
			DailyPlanBlock block = new DailyPlanBlock();
			block.setKind(spec.kind);
			block.setStartTime(spec.start);
			block.setEndTime(spec.end);
			block.setLabel(spec.label);
			block.setPosition(spec.position);
			if (spec.taskIndex >= 0) {
				block.setDailyPlanTask(builtTasks.get(spec.taskIndex));
			}
			revision.addBlock(block);
		}
	}

	private record TaskSpec(
			Task task,
			int rank,
			boolean mustInclude,
			UnplacedReason unplacedReason,
			Integer unplacedMinutes) {}

	private record BlockSpec(
			int taskIndex,
			BlockKind kind,
			LocalTime start,
			LocalTime end,
			String label,
			int position) {}
}
