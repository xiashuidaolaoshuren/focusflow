package com.focusflow.plan;

import com.focusflow.ai.AiDailyPlanRequest;
import com.focusflow.ai.AiDailyPlanResponse;
import com.focusflow.ai.AiPlanItem;
import com.focusflow.ai.AiPlanTask;
import com.focusflow.ai.AiProviderException;
import com.focusflow.ai.DailyPlanAiClient;
import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.GeneratePlanRequest;
import com.focusflow.plan.dto.ReplanRequest;
import com.focusflow.plan.dto.TaskEffortVersion;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.schedule.CutoffDecision;
import com.focusflow.schedule.ElapsedWork;
import com.focusflow.schedule.ElapsedWorkRules;
import com.focusflow.schedule.ReplanWindow;
import com.focusflow.security.CurrentUser;
import com.focusflow.dependency.BrokenDependencyOrderException;
import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.DependencyOrderRepair;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.InheritedRanking;
import com.focusflow.dependency.RankingCandidate;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskService;
import com.focusflow.user.OwnerSchedulingLock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DailyPlanService {

	private final DailyPlanAiClient aiClient;
	private final TaskQueryService taskQueryService;
	private final TaskService taskService;
	private final CurrentUser currentUser;
	private final DailyPlanRepository dailyPlanRepository;
	private final DailyPlanPersister persister;
	private final DailyPlanResponseMapper responseMapper;
	private final DailyPlanRankingValidator rankingValidator;
	private final SchedulingPreferencesQueryService schedulingPreferencesQueryService;
	private final CommitmentQueryService commitmentQueryService;
	private final DailyPlanScheduler scheduler;
	private final OwnerSchedulingLock ownerSchedulingLock;

	public DailyPlanService(
			DailyPlanAiClient aiClient,
			TaskQueryService taskQueryService,
			TaskService taskService,
			CurrentUser currentUser,
			DailyPlanRepository dailyPlanRepository,
			DailyPlanPersister persister,
			DailyPlanResponseMapper responseMapper,
			DailyPlanRankingValidator rankingValidator,
			DailyPlanScheduler scheduler,
			OwnerSchedulingLock ownerSchedulingLock,
			SchedulingPreferencesQueryService schedulingPreferencesQueryService,
			CommitmentQueryService commitmentQueryService) {
		this.aiClient = aiClient;
		this.taskQueryService = taskQueryService;
		this.taskService = taskService;
		this.currentUser = currentUser;
		this.dailyPlanRepository = dailyPlanRepository;
		this.persister = persister;
		this.responseMapper = responseMapper;
		this.rankingValidator = rankingValidator;
		this.scheduler = scheduler;
		this.ownerSchedulingLock = ownerSchedulingLock;
		this.schedulingPreferencesQueryService = schedulingPreferencesQueryService;
		this.commitmentQueryService = commitmentQueryService;
	}

	public DailyPlanResponse replan(Long planId, ReplanRequest request) {
		DailyPlan plan = loadPlanForCurrentUser(planId);
		if (!plan.getPlanDate().equals(request.currentDate())) {
			throw new ConflictException("REPLAN_NOT_TODAY", "plan date is not the client current date");
		}
		if (!PlanSchedulingSnapshot.isComplete(plan)) {
			throw new ConflictException(
					"REPLAN_LEGACY_SNAPSHOT", "plan has no complete scheduling snapshot");
		}
		CutoffDecision cutoffDecision =
				ReplanWindow.decide(
						plan.getWindowStart(), plan.getWindowEnd(), request.cutoff());
		if (cutoffDecision instanceof CutoffDecision.Rejected) {
			throw new ConflictException("REPLAN_WINDOW_ENDED", "cutoff is at or after the window end");
		}
		LocalTime effectiveCutoff = ((CutoffDecision.Accepted) cutoffDecision).effectiveCutoff();
		DailyPlanRevision latestRevision = plan.getLatestRevision();
		ElapsedWork elapsedWork =
				ElapsedWorkRules.classify(
						PlanRevisionBlocks.fromRevision(latestRevision), effectiveCutoff);
		if (!elapsedWork.unresolvedElapsed().isEmpty()
				|| !elapsedWork.unreconciledCrossing().isEmpty()) {
			throw new ConflictException(
					"ELAPSED_WORK_UNRESOLVED", "elapsed work must be resolved before re-planning");
		}
		Long ownerId = currentUser.getCurrentUser().id();
		List<Task> plannableTasks = taskQueryService.findPlannableTasksByOwnerId(ownerId);
		PlanReplanFreshness.validate(
				request.expectedRevisionId(),
				request.effortVersions(),
				latestRevision,
				plannableTasks);
		if (plannableTasks.size() > 100) {
			throw new BadRequestException("PLAN_CANDIDATE_LIMIT", "too many candidates");
		}
		LocalDate planDate = plan.getPlanDate();
		List<CommitmentWindow> commitments =
				commitmentQueryService.windowsFor(ownerId, planDate);
		EffectiveSchedulingPreferences preferences =
				CapturedSchedulingPreferences.fromPlan(plan, effectiveCutoff);
		PlanDependencyCapture capture =
				new PlanDependencyCapture(List.of(), List.of(), Map.of());
		List<AiPlanItem> aiItems;
		List<Task> rankedTasks;
		if (plannableTasks.isEmpty()) {
			aiItems = List.of();
			rankedTasks = List.of();
		} else {
			capture = captureDependencies(plannableTasks, ownerId, planDate);
			List<AiPlanTask> aiTasks = toAiPlanTasks(plannableTasks, capture);
			AiDailyPlanResponse aiResponse =
					aiClient.generate(new AiDailyPlanRequest(aiTasks, planDate));
			PlanPipelineResult pipeline =
					applyAiRanking(plannableTasks, capture, aiResponse.taskIds());
			rankedTasks = pipeline.rankedTasks();
			aiItems = pipeline.aiItems();
		}
		DailyPlanSchedule schedule =
				scheduler.compose(planDate, rankedTasks, preferences, commitments, capture);
		return persister.appendRevision(
				planId,
				request.expectedRevisionId(),
				request.effortVersions(),
				effectiveCutoff,
				aiItems,
				rankedTasks,
				schedule,
				capture);
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
		EffectiveSchedulingPreferences preferences =
				schedulingPreferencesQueryService.effectiveFor(ownerId);
		List<CommitmentWindow> commitments = commitmentQueryService.windowsFor(ownerId, planDate);
		PlanDependencyCapture capture = captureDependencies(activeTasks, ownerId, planDate);
		List<AiPlanTask> aiTasks = toAiPlanTasks(activeTasks, capture);
		AiDailyPlanResponse aiResponse = aiClient.generate(new AiDailyPlanRequest(aiTasks, planDate));
		PlanPipelineResult pipeline =
				applyAiRanking(activeTasks, capture, aiResponse.taskIds());
		DailyPlanSchedule schedule =
				scheduler.compose(
						planDate,
						pipeline.rankedTasks(),
						preferences,
						commitments,
						capture);
		return persister.persistPlan(
				ownerId,
				planDate,
				request.replacePlanId(),
				pipeline.aiItems(),
				pipeline.rankedTasks(),
				schedule,
				capture);
	}

	private record PlanPipelineResult(List<Task> rankedTasks, List<AiPlanItem> aiItems) {}

	private PlanPipelineResult applyAiRanking(
			List<Task> plannableTasks,
			PlanDependencyCapture capture,
			List<Long> modelOrder) {
		rankingValidator.validateOrder(capture.assignments(), modelOrder);
		Map<Long, RankingGroup> groupsByTaskId = new HashMap<>();
		for (InheritedAssignment assignment : capture.assignments()) {
			groupsByTaskId.put(assignment.taskId(), assignment.group());
		}
		List<Long> repairedIds;
		try {
			repairedIds =
					DependencyOrderRepair.repair(modelOrder, capture.links(), groupsByTaskId);
		} catch (BrokenDependencyOrderException ex) {
			throw new AiProviderException(ex.getMessage());
		}
		return new PlanPipelineResult(
				orderTasksByAiRanking(plannableTasks, repairedIds),
				toPositionedPlanItems(repairedIds));
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
		DailyPlan plan = loadPlanForCurrentUser(planId);
		PlanReplacePreconditions.rejectIfHasProgress(plan);
		dailyPlanRepository.delete(plan);
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
				Boolean.TRUE.equals(projection.getHasWarning()),
				Boolean.TRUE.equals(projection.getHasProgress()),
				Boolean.TRUE.equals(projection.getNeedsRefresh()));
	}

	private PlanDependencyCapture captureDependencies(
			List<Task> plannableTasks, Long ownerId, LocalDate planDate) {
		List<DependencyLink> links = taskQueryService.findLinksByOwnerId(ownerId);
		List<RankingCandidate> candidates =
				plannableTasks.stream()
						.map(
								task ->
										new RankingCandidate(
												task.getId() != null ? task.getId() : 0L,
												task.getStatus(),
												task.getDueDate()))
						.toList();
		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, planDate, Set.of());
		Map<Long, Long> checkpointIdByTaskId = new HashMap<>();
		for (Task task : plannableTasks) {
			long taskId = task.getId() != null ? task.getId() : 0L;
			taskService
					.latestCheckpointId(task)
					.ifPresent(id -> checkpointIdByTaskId.put(taskId, id));
		}
		return new PlanDependencyCapture(links, assignments, checkpointIdByTaskId);
	}

	private List<AiPlanTask> toAiPlanTasks(List<Task> tasks, PlanDependencyCapture capture) {
		Map<Long, InheritedAssignment> assignmentByTaskId = new HashMap<>();
		for (InheritedAssignment assignment : capture.assignments()) {
			assignmentByTaskId.put(assignment.taskId(), assignment);
		}
		return tasks.stream()
				.map(
						task -> {
							long taskId = task.getId() != null ? task.getId() : 0L;
							InheritedAssignment assignment = assignmentByTaskId.get(taskId);
							RankingGroup block =
									assignment != null ? assignment.group() : RankingGroup.OPTIONAL;
							List<Long> blockedBy = activeBlockerIds(taskId, capture.links());
							return new AiPlanTask(
									taskId,
									task.getTitle(),
									task.getDescription(),
									task.getPriority(),
									task.getDueDate(),
									task.getEstimatedMinutes(),
									task.getRemainingEffortMinutes(),
									task.getStatus(),
									block,
									blockedBy);
						})
				.toList();
	}

	private static List<Long> activeBlockerIds(long taskId, List<DependencyLink> links) {
		return links.stream()
				.filter(link -> link.blockedId() == taskId && link.blockerPlannable())
				.map(DependencyLink::blockerId)
				.sorted()
				.toList();
	}
}
