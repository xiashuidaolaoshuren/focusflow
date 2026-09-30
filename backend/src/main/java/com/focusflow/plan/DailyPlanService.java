package com.focusflow.plan;

import com.focusflow.ai.AiDailyPlanRequest;
import com.focusflow.ai.AiDailyPlanResponse;
import com.focusflow.ai.AiPlanItem;
import com.focusflow.ai.AiPlanTask;
import com.focusflow.ai.DailyPlanAiClient;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.GeneratePlanRequest;
import com.focusflow.security.CurrentUser;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.UserRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailyPlanService {

	private final DailyPlanAiClient aiClient;
	private final TaskQueryService taskQueryService;
	private final UserRepository userRepository;
	private final CurrentUser currentUser;
	private final DailyPlanRepository dailyPlanRepository;
	private final DailyPlanPersister persister;
	private final DailyPlanResponseMapper responseMapper;
	private final DailyPlanRankingValidator rankingValidator;
	private final DailyPlanScheduler scheduler;
	private final OwnerSchedulingLock ownerSchedulingLock;

	public DailyPlanService(
			DailyPlanAiClient aiClient,
			TaskQueryService taskQueryService,
			UserRepository userRepository,
			CurrentUser currentUser,
			DailyPlanRepository dailyPlanRepository,
			DailyPlanPersister persister,
			DailyPlanResponseMapper responseMapper,
			DailyPlanRankingValidator rankingValidator,
			DailyPlanScheduler scheduler,
			OwnerSchedulingLock ownerSchedulingLock) {
		this.aiClient = aiClient;
		this.taskQueryService = taskQueryService;
		this.userRepository = userRepository;
		this.currentUser = currentUser;
		this.dailyPlanRepository = dailyPlanRepository;
		this.persister = persister;
		this.responseMapper = responseMapper;
		this.rankingValidator = rankingValidator;
		this.scheduler = scheduler;
		this.ownerSchedulingLock = ownerSchedulingLock;
	}

	public DailyPlanResponse generate(GeneratePlanRequest request) {
		Long ownerId = currentUser.getCurrentUser().id();
		LocalDate planDate = request.planDate();
		Optional<DailyPlan> latestPlan =
				dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						ownerId, planDate);
		PlanReplacePreconditions.validateReplacePrecondition(latestPlan, request.replacePlanId());
		List<Task> activeTasks = taskQueryService.findPlannableTasksByOwnerId(ownerId);
		if (activeTasks.isEmpty()) {
			throw new BadRequestException("no plannable tasks available for planning");
		}
		if (activeTasks.size() > 100) {
			throw new BadRequestException("PLAN_CANDIDATE_LIMIT", "too many candidates");
		}
		List<AiPlanTask> aiTasks = activeTasks.stream().map(this::toAiPlanTask).toList();
		AiDailyPlanResponse aiResponse = aiClient.generate(new AiDailyPlanRequest(aiTasks, planDate));
		rankingValidator.validateOrder(activeTasks, planDate, aiResponse.taskIds());
		List<Task> rankedTasks = orderTasksByAiRanking(activeTasks, aiResponse.taskIds());
		List<AiPlanItem> aiItems = toPositionedPlanItems(aiResponse.taskIds());
		DailyPlanSchedule schedule = scheduler.compose(ownerId, planDate, rankedTasks);
		return persister.persistPlan(
				ownerId, planDate, request.replacePlanId(), aiItems, schedule);
	}

	private List<Task> orderTasksByAiRanking(List<Task> activeTasks, List<Long> orderedTaskIds) {
		Map<Long, Task> taskById = new LinkedHashMap<>();
		for (Task task : activeTasks) {
			taskById.put(task.getId() != null ? task.getId() : 0L, task);
		}
		List<Task> rankedTasks = new ArrayList<>(orderedTaskIds.size());
		for (Long taskId : orderedTaskIds) {
			rankedTasks.add(taskById.get(taskId));
		}
		return rankedTasks;
	}

	private List<AiPlanItem> toPositionedPlanItems(List<Long> orderedTaskIds) {
		List<AiPlanItem> items = new ArrayList<>(orderedTaskIds.size());
		for (int index = 0; index < orderedTaskIds.size(); index++) {
			items.add(new AiPlanItem(orderedTaskIds.get(index), index + 1));
		}
		return items;
	}

	public PageResponse<DailyPlanSummaryResponse> listForCurrentUser(int page, int size) {
		if (page < 0) {
			throw new BadRequestException("page must be non-negative");
		}
		if (size < 1 || size > 100) {
			throw new BadRequestException("size must be between 1 and 100");
		}
		Long ownerId = currentUser.getCurrentUser().id();
		Page<DailyPlanSummaryProjection> summaries =
				dailyPlanRepository.findSummariesByOwner(ownerId, PageRequest.of(page, size));
		List<DailyPlanSummaryResponse> content =
				summaries.getContent().stream().map(this::toSummaryResponse).toList();
		return new PageResponse<>(
				content,
				summaries.getNumber(),
				summaries.getSize(),
				summaries.getTotalElements(),
				summaries.getTotalPages());
	}

	public Optional<DailyPlanResponse> byDateForCurrentUser(LocalDate planDate) {
		if (planDate == null) {
			throw new BadRequestException("planDate is required");
		}
		Long ownerId = currentUser.getCurrentUser().id();
		return dailyPlanRepository
				.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(ownerId, planDate)
				.map(responseMapper::toResponse);
	}

	public DailyPlanResponse getForCurrentUser(Long planId) {
		return responseMapper.toResponse(loadPlanForCurrentUser(planId));
	}

	@Transactional
	public void deleteForCurrentUser(Long planId) {
		ownerSchedulingLock.lockCurrentOwner();
		dailyPlanRepository.delete(loadPlanForCurrentUser(planId));
	}

	private DailyPlan loadPlanForCurrentUser(Long planId) {
		Long ownerId = currentUser.getCurrentUser().id();
		return dailyPlanRepository
				.findByOwner_IdAndId(ownerId, planId)
				.orElseThrow(() -> new NotFoundException("daily plan not found"));
	}

	private DailyPlanSummaryResponse toSummaryResponse(DailyPlanSummaryProjection projection) {
		return new DailyPlanSummaryResponse(
				projection.getId(),
				projection.getPlanDate(),
				projection.getCreatedAt(),
				projection.getScheduledWorkMinutes() != null ? projection.getScheduledWorkMinutes() : 0,
				projection.getWorkSessionCount() != null ? projection.getWorkSessionCount() : 0,
				projection.getScheduledTaskCount() != null ? projection.getScheduledTaskCount() : 0,
				projection.getUnplacedWorkCount() != null ? projection.getUnplacedWorkCount() : 0,
				Boolean.TRUE.equals(projection.getHasWarning()));
	}

	private AiPlanTask toAiPlanTask(Task task) {
		return new AiPlanTask(
				task.getId() != null ? task.getId() : 0L,
				task.getTitle(),
				task.getDescription(),
				task.getPriority(),
				task.getDueDate(),
				task.getEstimatedMinutes(),
				task.getStatus());
	}
}
