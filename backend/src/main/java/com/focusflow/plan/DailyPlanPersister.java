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
			List<Task> capturedTasks,
			DailyPlanSchedule schedule) {
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
		DailyPlan plan = buildPlan(owner, planDate, aiItems, capturedById, taskById, schedule);
		dailyPlanRepository.save(plan);
		dailyPlanRepository.flush();

		Map<Long, DailyPlanTask> planTaskBySourceId =
				plan.getTasks().stream()
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
			plan.addBlock(planBlock);
		}
		return responseMapper.toResponse(dailyPlanRepository.saveAndFlush(plan));
	}

	private DailyPlan buildPlan(
			User owner,
			LocalDate planDate,
			List<AiPlanItem> aiItems,
			Map<Long, Task> capturedById,
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

		Map<Long, UnplacedWork> unplacedBySourceId =
				schedule.unplacedWork().stream()
						.collect(
								Collectors.toMap(
										UnplacedWork::sourceTaskId,
										Function.identity(),
										(first, second) -> first));

		for (AiPlanItem aiItem : aiItems) {
			Task captured = capturedById.get(aiItem.taskId());
			Task reference = taskById.get(aiItem.taskId());
			DailyPlanTask planTask = new DailyPlanTask();
			planTask.setRank(aiItem.position());
			planTask.setSourceTaskId(captured.getId() != null ? captured.getId() : 0L);
			planTask.setTaskReference(reference);
			planTask.setTaskTitle(captured.getTitle());
			planTask.setTaskPriority(captured.getPriority());
			planTask.setTaskStatus(captured.getStatus());
			planTask.setTaskDueDate(captured.getDueDate());
			planTask.setTaskEstimatedMinutes(captured.getEstimatedMinutes());
			planTask.setMustInclude(PlanMustIncludeRules.isMustInclude(captured, planDate));
			UnplacedWork unplaced = unplacedBySourceId.get(planTask.getSourceTaskId());
			if (unplaced != null) {
				planTask.setUnplacedReason(unplaced.reason());
				planTask.setUnplacedMinutes(unplaced.unplacedMinutes());
			}
			plan.addTask(planTask);
		}

		return plan;
	}
}
