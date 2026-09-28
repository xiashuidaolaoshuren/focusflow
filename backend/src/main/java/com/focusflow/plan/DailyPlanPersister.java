package com.focusflow.plan;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskStatus;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DailyPlanPersister {

	private final UserRepository userRepository;
	private final TaskQueryService taskQueryService;
	private final DailyPlanRepository dailyPlanRepository;
	private final DailyPlanResponseMapper responseMapper;

	public DailyPlanPersister(
			UserRepository userRepository,
			TaskQueryService taskQueryService,
			DailyPlanRepository dailyPlanRepository,
			DailyPlanResponseMapper responseMapper) {
		this.userRepository = userRepository;
		this.taskQueryService = taskQueryService;
		this.dailyPlanRepository = dailyPlanRepository;
		this.responseMapper = responseMapper;
	}

	@Transactional
	public DailyPlanResponse persistPlan(
			Long ownerId,
			LocalDate planDate,
			List<AiPlanItem> aiItems,
			int availableMinutes) {
		User owner =
				userRepository
						.findById(ownerId)
						.orElseThrow(() -> new NotFoundException("user not found"));
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
				throw new ConflictException("a selected task is no longer available");
			}
		}
		DailyPlan plan = buildPlan(owner, planDate, aiItems, taskById, availableMinutes);
		return responseMapper.toResponse(dailyPlanRepository.save(plan));
	}

	private DailyPlan buildPlan(
			User owner,
			LocalDate planDate,
			List<AiPlanItem> aiItems,
			Map<Long, Task> taskById,
			int availableMinutes) {
		DailyPlan plan = new DailyPlan();
		plan.setOwner(owner);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(Instant.now());
		plan.setWindowStart(LocalTime.of(9, 0));
		plan.setWindowEnd(LocalTime.of(18, 0));
		plan.setFreeMinutes(availableMinutes);
		plan.setScheduledWorkMinutes(0);
		plan.setRequiredMinutes(0L);
		plan.setRequestedBufferMinutes(0);
		plan.setRealizedBufferMinutes(0);
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
			planTask.setMustInclude(isMustInclude(task, planDate));
			plan.addTask(planTask);
		}
		return plan;
	}

	private boolean isMustInclude(Task task, LocalDate planDate) {
		if (task.getStatus() == TaskStatus.IN_PROGRESS) {
			return true;
		}
		if (task.getStatus() == TaskStatus.OPEN) {
			LocalDate dueDate = task.getDueDate();
			return dueDate != null && !dueDate.isAfter(planDate);
		}
		return false;
	}
}
