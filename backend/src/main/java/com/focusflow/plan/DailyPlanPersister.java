package com.focusflow.plan;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.common.error.ConflictException;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.schedule.UnplacedWork;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
			DailyPlanSchedule schedule) {
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Optional<DailyPlan> latestPlan =
				dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						ownerId, planDate);
		PlanReplacePreconditions.validateReplacePrecondition(latestPlan, replacePlanId);
		latestPlan.ifPresent(dailyPlanRepository::delete);

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

		DailyPlan plan = buildPlan(owner, planDate, aiItems, taskById, schedule);
		return responseMapper.toResponse(dailyPlanRepository.save(plan));
	}

	private DailyPlan buildPlan(
			User owner,
			LocalDate planDate,
			List<AiPlanItem> aiItems,
			Map<Long, Task> taskById,
			DailyPlanSchedule schedule) {
		DailyPlan plan = new DailyPlan();
		plan.setOwner(owner);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(Instant.now());
		plan.setWindowStart(schedule.windowStart());
		plan.setWindowEnd(schedule.windowEnd());
		plan.setPeakStart(schedule.peakStart());
		plan.setPeakEnd(schedule.peakEnd());
		plan.setFreeMinutes(schedule.freeMinutes());
		plan.setScheduledWorkMinutes(schedule.scheduledWorkMinutes());
		plan.setRequiredMinutes(schedule.requiredMinutes());
		plan.setRequestedBufferMinutes(schedule.requestedBufferMinutes());
		plan.setRealizedBufferMinutes(schedule.realizedBufferMinutes());

		Map<Long, DailyPlanTask> planTaskBySourceId = new HashMap<>();
		Map<Long, UnplacedWork> unplacedBySourceId =
				schedule.unplacedWork().stream()
						.collect(
								Collectors.toMap(
										UnplacedWork::sourceTaskId,
										Function.identity(),
										(first, second) -> first));

		for (AiPlanItem aiItem : aiItems) {
			Task task = taskById.get(aiItem.taskId());
			DailyPlanTask planTask = new DailyPlanTask();
			planTask.setRank(aiItem.position());
			planTask.setSourceTaskId(task.getId() != null ? task.getId() : 0L);
			planTask.setTaskReference(task);
			planTask.setTaskTitle(task.getTitle());
			planTask.setTaskPriority(task.getPriority());
			planTask.setTaskStatus(task.getStatus());
			planTask.setTaskDueDate(task.getDueDate());
			planTask.setTaskEstimatedMinutes(task.getEstimatedMinutes());
			planTask.setMustInclude(PlanMustIncludeRules.isMustInclude(task, planDate));
			UnplacedWork unplaced = unplacedBySourceId.get(planTask.getSourceTaskId());
			if (unplaced != null) {
				planTask.setUnplacedReason(unplaced.reason());
				planTask.setUnplacedMinutes(unplaced.unplacedMinutes());
			}
			plan.addTask(planTask);
			planTaskBySourceId.put(planTask.getSourceTaskId(), planTask);
		}

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
			plan.addBlock(planBlock);
		}

		return plan;
	}
}
