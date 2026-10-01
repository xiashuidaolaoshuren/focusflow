package com.focusflow.task;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.task.dto.UpdateTaskRequest;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskService {

	private final TaskRepository taskRepository;
	private final UserRepository userRepository;
	private final CurrentUser currentUser;
	private final TaskResponseMapper taskResponseMapper;

	public TaskService(
			TaskRepository taskRepository,
			UserRepository userRepository,
			CurrentUser currentUser,
			TaskResponseMapper taskResponseMapper) {
		this.taskRepository = taskRepository;
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
	public TaskResponse updateForCurrentUser(Long taskId, UpdateTaskRequest request) {
		requireNullOrPositiveEstimate(request.estimatedMinutes());
		Task task = loadTaskForCurrentUser(taskId);
		task.setTitle(request.title());
		task.setDescription(request.description());
		task.setPriority(
				request.priority() != null ? request.priority() : TaskPriority.MEDIUM);
		task.setStatus(request.status() != null ? request.status() : TaskStatus.OPEN);
		task.setDueDate(request.dueDate());
		task.setEstimatedMinutes(request.estimatedMinutes());
		return taskResponseMapper.toResponse(taskRepository.save(task));
	}

	@Transactional
	public void deleteForCurrentUser(Long taskId) {
		Task task = loadTaskForCurrentUser(taskId);
		taskRepository.delete(task);
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
