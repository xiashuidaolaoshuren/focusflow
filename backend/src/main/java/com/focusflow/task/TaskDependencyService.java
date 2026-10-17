package com.focusflow.task;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.dependency.DependencyCycleCheck;
import com.focusflow.dependency.DependencyLink;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskDependencyService {

	private final OwnerSchedulingLock ownerSchedulingLock;
	private final TaskRepository taskRepository;
	private final TaskDependencyRepository taskDependencyRepository;
	private final TaskQueryService taskQueryService;
	private final TaskResponseMapper taskResponseMapper;

	public TaskDependencyService(
			OwnerSchedulingLock ownerSchedulingLock,
			TaskRepository taskRepository,
			TaskDependencyRepository taskDependencyRepository,
			TaskQueryService taskQueryService,
			TaskResponseMapper taskResponseMapper) {
		this.ownerSchedulingLock = ownerSchedulingLock;
		this.taskRepository = taskRepository;
		this.taskDependencyRepository = taskDependencyRepository;
		this.taskQueryService = taskQueryService;
		this.taskResponseMapper = taskResponseMapper;
	}

	@Transactional
	public TaskResponse addBlocker(long blockedTaskId, long blockerTaskId) {
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Long ownerId = owner.getId();

		Task blocked =
				taskRepository
						.findByOwner_IdAndId(ownerId, blockedTaskId)
						.orElseThrow(() -> new NotFoundException("task not found"));
		taskRepository
				.findByOwner_IdAndId(ownerId, blockerTaskId)
				.orElseThrow(() -> new NotFoundException("task not found"));

		if (blockerTaskId == blockedTaskId) {
			throw new BadRequestException("SELF_DEPENDENCY", "a task cannot block itself");
		}

		if (taskDependencyRepository.existsByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
				ownerId, blockedTaskId, blockerTaskId)) {
			throw new ConflictException("DEPENDENCY_EXISTS", "dependency already exists");
		}

		List<DependencyLink> links = taskQueryService.findLinksByOwnerId(ownerId);
		if (DependencyCycleCheck.wouldCycle(links, blockerTaskId, blockedTaskId)) {
			throw new ConflictException("DEPENDENCY_CYCLE", "dependency would create a cycle");
		}

		TaskDependency dependency = new TaskDependency();
		dependency.setOwner(owner);
		dependency.setBlockedTaskId(blockedTaskId);
		dependency.setBlockerTaskId(blockerTaskId);
		taskDependencyRepository.save(dependency);

		return taskResponseMapper.toResponse(blocked);
	}

	@Transactional
	public void removeBlocker(long blockedTaskId, long blockerTaskId) {
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Long ownerId = owner.getId();

		TaskDependency dependency =
				taskDependencyRepository
						.findByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
								ownerId, blockedTaskId, blockerTaskId)
						.orElseThrow(() -> new NotFoundException("dependency not found"));
		taskDependencyRepository.delete(dependency);
	}
}
