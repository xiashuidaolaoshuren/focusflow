package com.focusflow.task;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.effort.EffortAssessment;
import com.focusflow.effort.EffortEvent;
import com.focusflow.effort.RemainingEffortCalculator;
import com.focusflow.plan.DailyPlanBlockRepository;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.RemainingEffortRequest;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.task.dto.UpdateTaskRequest;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

	private final TaskRepository taskRepository;
	private final RemainingEffortCheckpointRepository remainingEffortCheckpointRepository;
	private final DailyPlanBlockRepository dailyPlanBlockRepository;
	private final UserRepository userRepository;
	private final CurrentUser currentUser;
	private final TaskResponseMapper taskResponseMapper;

	public TaskService(
			TaskRepository taskRepository,
			RemainingEffortCheckpointRepository remainingEffortCheckpointRepository,
			DailyPlanBlockRepository dailyPlanBlockRepository,
			UserRepository userRepository,
			CurrentUser currentUser,
			TaskResponseMapper taskResponseMapper) {
		this.taskRepository = taskRepository;
		this.remainingEffortCheckpointRepository = remainingEffortCheckpointRepository;
		this.dailyPlanBlockRepository = dailyPlanBlockRepository;
		this.userRepository = userRepository;
		this.currentUser = currentUser;
		this.taskResponseMapper = taskResponseMapper;
	}

	@Transactional
	public TaskResponse create(CreateTaskRequest request) {
		requireNullOrPositiveEstimate(request.estimatedMinutes());
		User owner = loadCurrentUserEntity();

		Task task = new Task();
		task.setOwner(owner);
		task.setTitle(request.title());
		task.setDescription(request.description());
		task.setPriority(
				request.priority() != null ? request.priority() : TaskPriority.MEDIUM);
		task.setStatus(TaskStatus.OPEN);
		task.setDueDate(request.dueDate());
		task.setEstimatedMinutes(request.estimatedMinutes());
		task.setRemainingEffortMinutes(request.estimatedMinutes());
		task.setEffortVersion(0);

		return taskResponseMapper.toResponse(taskRepository.save(task));
	}

	public List<TaskResponse> listForCurrentUser() {
		Long ownerId = currentUser.getCurrentUser().id();
		return taskRepository.findByOwner_IdOrderByDueDateAsc(ownerId).stream()
				.map(taskResponseMapper::toResponse)
				.toList();
	}

	public TaskResponse getForCurrentUser(Long taskId) {
		return taskResponseMapper.toResponse(loadTaskForCurrentUser(taskId));
	}

	@Transactional
	public void recordRemainingEffortCheckpoint(
			Task task, LocalDate workDate, Integer assessedRemainingMinutes) {
		saveCheckpoint(task, workDate, assessedRemainingMinutes);
	}

	/**
	 * When the most recent remaining-effort checkpoint for a Task was recorded, or null when the
	 * Task has none. Plan-side callers use this to tell whether newer effort state already replaced
	 * an earlier block credit.
	 */
	public Instant latestCheckpointRecordedAt(Task task) {
		return remainingEffortCheckpointRepository
				.findFirstByTaskReference_IdOrderByRecordedAtDesc(task)
				.map(RemainingEffortCheckpoint::getRecordedAt)
				.orElse(null);
	}

	@Transactional
	public TaskResponse updateForCurrentUser(Long taskId, UpdateTaskRequest request) {
		requireNullOrPositiveEstimate(request.estimatedMinutes());
		Task task = loadTaskForCurrentUser(taskId);
		requireMatchingEffortVersion(task, request.effortVersion());
		Integer previousEstimate = task.getEstimatedMinutes();
		TaskStatus previousStatus = task.getStatus();
		task.setTitle(request.title());
		task.setDescription(request.description());
		task.setPriority(
				request.priority() != null ? request.priority() : TaskPriority.MEDIUM);
		TaskStatus nextStatus = request.status() != null ? request.status() : TaskStatus.OPEN;
		task.setDueDate(request.dueDate());
		task.setEstimatedMinutes(request.estimatedMinutes());
		if (shouldSyncRemainingFromEstimate(task, previousEstimate, request.estimatedMinutes())) {
			task.setRemainingEffortMinutes(request.estimatedMinutes());
			task.setEffortVersion(task.getEffortVersion() + 1);
		}
		if (nextStatus == TaskStatus.DONE && previousStatus != TaskStatus.DONE) {
			requireCurrentDate(request.currentDate());
			finishTask(task, request.currentDate());
		} else if (nextStatus == TaskStatus.CANCELLED && previousStatus != TaskStatus.CANCELLED) {
			task.setEffortVersion(task.getEffortVersion() + 1);
		} else if (isReopen(previousStatus, nextStatus)) {
			requireCurrentDate(request.currentDate());
			reopenTask(task, request.currentDate(), request.remainingEffortMinutes());
		}
		task.setStatus(nextStatus);
		return taskResponseMapper.toResponse(taskRepository.save(task));
	}

	private void finishTask(Task task, LocalDate workDate) {
		applyCheckpoint(task, workDate, 0);
	}

	private void applyCheckpoint(Task task, LocalDate workDate, Integer assessedRemainingMinutes) {
		EffortEvent.Checkpoint checkpoint =
				new EffortEvent.Checkpoint(
						workDate, Instant.now(), task.getEffortVersion() + 1L, assessedRemainingMinutes);
		EffortAssessment assessment =
				RemainingEffortCalculator.apply(
						task.getRemainingEffortMinutes(), List.of(checkpoint));
		task.setRemainingEffortMinutes(assessment.remainingMinutes());
		task.setEffortVersion(task.getEffortVersion() + 1);
		saveCheckpoint(task, workDate, assessedRemainingMinutes);
	}

	private void saveCheckpoint(Task task, LocalDate workDate, Integer assessedRemainingMinutes) {
		RemainingEffortCheckpoint checkpoint = new RemainingEffortCheckpoint();
		checkpoint.setOwner(task.getOwner());
		checkpoint.setSourceTaskId(task.getId());
		checkpoint.setTaskReference(task);
		checkpoint.setWorkDate(workDate);
		checkpoint.setRecordedAt(Instant.now());
		checkpoint.setAssessedRemainingMinutes(assessedRemainingMinutes);
		remainingEffortCheckpointRepository.save(checkpoint);
	}

	private static void requireCurrentDate(LocalDate currentDate) {
		if (currentDate == null) {
			throw new BadRequestException("current date is required");
		}
	}

	private static boolean isReopen(TaskStatus previousStatus, TaskStatus nextStatus) {
		if (nextStatus != TaskStatus.OPEN && nextStatus != TaskStatus.IN_PROGRESS) {
			return false;
		}
		return previousStatus == TaskStatus.DONE || previousStatus == TaskStatus.CANCELLED;
	}

	private void reopenTask(Task task, LocalDate workDate, Integer remainingEffortMinutes) {
		applyCheckpoint(task, workDate, remainingEffortMinutes);
	}

	private boolean shouldSyncRemainingFromEstimate(
			Task task, Integer previousEstimate, Integer nextEstimate) {
		if (nextEstimate == null || Objects.equals(previousEstimate, nextEstimate)) {
			return false;
		}
		if (task.getStatus() != TaskStatus.OPEN) {
			return false;
		}
		Long taskId = task.getId();
		return taskId == null
				|| (!remainingEffortCheckpointRepository.existsByTaskReference_Id(taskId)
						&& !dailyPlanBlockRepository
								.existsByDailyPlanTask_TaskReference_IdAndOutcomeIsNotNull(taskId));
	}

	@Transactional
	public TaskResponse reassessRemainingEffortForCurrentUser(
			Long taskId, RemainingEffortRequest request) {
		requireCurrentDate(request.currentDate());
		Task task = loadTaskForCurrentUser(taskId);
		requireMatchingEffortVersion(task, request.effortVersion());
		applyCheckpoint(task, request.currentDate(), request.remainingEffortMinutes());
		return taskResponseMapper.toResponse(taskRepository.save(task));
	}

	@Transactional
	public void deleteForCurrentUser(Long taskId) {
		Task task = loadTaskForCurrentUser(taskId);
		detachCheckpointReferences(task);
		taskRepository.delete(task);
	}

	private void detachCheckpointReferences(Task task) {
		Long taskId = task.getId();
		if (taskId == null) {
			return;
		}
		for (RemainingEffortCheckpoint checkpoint :
				remainingEffortCheckpointRepository.findByTaskReference_Id(taskId)) {
			checkpoint.setTaskReference(null);
			remainingEffortCheckpointRepository.save(checkpoint);
		}
	}

	private static void requireMatchingEffortVersion(Task task, Integer expectedEffortVersion) {
		if (expectedEffortVersion != null && expectedEffortVersion != task.getEffortVersion()) {
			throw new ConflictException("PROGRESS_CONFLICT", "task effort has changed");
		}
	}

	private static void requireNullOrPositiveEstimate(Integer estimatedMinutes) {
		if (estimatedMinutes != null && estimatedMinutes <= 0) {
			throw new BadRequestException("estimated minutes must be null or positive");
		}
	}

	private User loadCurrentUserEntity() {
		UserContext current = currentUser.getCurrentUser();
		return userRepository
				.findById(current.id())
				.orElseThrow(() -> new NotFoundException("user not found"));
	}

	private Task loadTaskForCurrentUser(Long taskId) {
		Long ownerId = currentUser.getCurrentUser().id();
		return taskRepository
				.findByOwner_IdAndId(ownerId, taskId)
				.orElseThrow(() -> new NotFoundException("task not found"));
	}

}
