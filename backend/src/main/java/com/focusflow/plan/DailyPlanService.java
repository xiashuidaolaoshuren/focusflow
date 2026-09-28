package com.focusflow.plan;

import com.focusflow.ai.AiDailyPlanRequest;
import com.focusflow.ai.AiDailyPlanResponse;
import com.focusflow.ai.AiPlanTask;
import com.focusflow.ai.DailyPlanAiClient;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.GeneratePlanRequest;
import com.focusflow.security.CurrentUser;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskStatus;
import com.focusflow.user.UserRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
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

	public DailyPlanService(
			DailyPlanAiClient aiClient,
			TaskQueryService taskQueryService,
			UserRepository userRepository,
			CurrentUser currentUser,
			DailyPlanRepository dailyPlanRepository,
			DailyPlanPersister persister,
			DailyPlanResponseMapper responseMapper,
			DailyPlanRankingValidator rankingValidator) {
		this.aiClient = aiClient;
		this.taskQueryService = taskQueryService;
		this.userRepository = userRepository;
		this.currentUser = currentUser;
		this.dailyPlanRepository = dailyPlanRepository;
		this.persister = persister;
		this.responseMapper = responseMapper;
		this.rankingValidator = rankingValidator;
	}

	public DailyPlanResponse generate(GeneratePlanRequest request) {
		Long ownerId = currentUser.getCurrentUser().id();
		LocalDate planDate = request.planDate();
		Optional<DailyPlan> latestPlan =
				dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						ownerId, planDate);
		validateReplacePrecondition(latestPlan, request.replacePlanId());
		List<Task> activeTasks = taskQueryService.findPlannableTasksByOwnerId(ownerId);
		if (activeTasks.isEmpty()) {
			throw new BadRequestException("no plannable tasks available for planning");
		}
		if (activeTasks.size() > 100) {
			throw new BadRequestException("PLAN_CANDIDATE_LIMIT", "too many candidates");
		}
		List<AiPlanTask> aiTasks = activeTasks.stream().map(this::toAiPlanTask).toList();
		AiDailyPlanResponse aiResponse =
				aiClient.generate(new AiDailyPlanRequest(aiTasks, request.availableMinutes(), planDate));
		rankingValidator.validate(
				activeTasks, planDate, request.availableMinutes(), aiResponse.items());
		DailyPlanWarningSnapshot warning =
				computeWarning(activeTasks, planDate, request.availableMinutes());
		return persister.persistPlan(
				ownerId, planDate, aiResponse.items(), request.availableMinutes(), warning);
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

	public Optional<DailyPlanResponse> latestForCurrentUser(LocalDate planDate) {
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
		dailyPlanRepository.delete(loadPlanForCurrentUser(planId));
	}

	private void validateReplacePrecondition(Optional<DailyPlan> latestPlan, Long replacePlanId) {
		if (latestPlan.isPresent()) {
			if (replacePlanId == null) {
				throw new ConflictException("PLAN_EXISTS", "plan already exists");
			}
			if (!latestPlan.get().getId().equals(replacePlanId)) {
				throw new ConflictException("PLAN_CHANGED", "plan has changed");
			}
		} else if (replacePlanId != null) {
			throw new ConflictException("PLAN_CHANGED", "plan has changed");
		}
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
				projection.getItemCount() != null ? projection.getItemCount() : 0,
				Boolean.TRUE.equals(projection.getHasWarning()),
				projection.getAvailableMinutes());
	}

	private DailyPlanWarningSnapshot computeWarning(
			List<Task> candidates, LocalDate planDate, int availableMinutes) {
		List<DailyPlanWarningSnapshot.EstimatedTask> estimatedTasks = new ArrayList<>();
		List<DailyPlanWarningSnapshot.UnestimatedTask> unestimatedTasks = new ArrayList<>();
		int minimumAvailableMinutes = 0;

		for (Task candidate : candidates) {
			if (!isMustInclude(candidate, planDate)) {
				continue;
			}
			long taskId = candidate.getId() != null ? candidate.getId() : 0L;
			Integer estimate = candidate.getEstimatedMinutes();
			if (estimate != null) {
				minimumAvailableMinutes += estimate;
				estimatedTasks.add(
						new DailyPlanWarningSnapshot.EstimatedTask(
								taskId, candidate.getTitle(), estimate));
			} else {
				unestimatedTasks.add(
						new DailyPlanWarningSnapshot.UnestimatedTask(taskId, candidate.getTitle()));
			}
		}

		if (unestimatedTasks.isEmpty() && availableMinutes >= minimumAvailableMinutes) {
			return null;
		}
		return new DailyPlanWarningSnapshot(
				minimumAvailableMinutes, estimatedTasks, unestimatedTasks);
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
