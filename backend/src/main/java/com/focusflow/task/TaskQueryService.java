package com.focusflow.task;

import com.focusflow.dependency.DependencyLink;
import java.time.LocalDate;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class TaskQueryService {

	private final TaskRepository taskRepository;
	private final UnplannedWorkRepository unplannedWorkRepository;
	private final TaskDependencyRepository taskDependencyRepository;

	public TaskQueryService(
			TaskRepository taskRepository,
			UnplannedWorkRepository unplannedWorkRepository,
			TaskDependencyRepository taskDependencyRepository) {
		this.taskRepository = taskRepository;
		this.unplannedWorkRepository = unplannedWorkRepository;
		this.taskDependencyRepository = taskDependencyRepository;
	}

	public List<UnplannedWork> findUnplannedWorkByOwnerIdAndWorkDate(
			Long ownerId, LocalDate workDate) {
		return unplannedWorkRepository.findByOwner_IdAndWorkDate(ownerId, workDate);
	}

	public List<Task> findOpenTasksByOwnerId(Long ownerId) {
		return taskRepository.findByOwner_IdAndStatusOrderByDueDateAsc(ownerId, TaskStatus.OPEN);
	}

	public List<Task> findPlannableTasksByOwnerId(Long ownerId) {
		return taskRepository.findByOwner_IdAndStatusInOrderByDueDateAsc(
				ownerId, List.of(TaskStatus.OPEN, TaskStatus.IN_PROGRESS));
	}

	public List<Task> findOwnedTasksByIds(Long ownerId, Collection<Long> taskIds) {
		if (taskIds.isEmpty()) {
			return List.of();
		}
		return taskRepository.findByOwner_IdAndIdIn(ownerId, taskIds);
	}

	public List<DependencyLink> findLinksByOwnerId(Long ownerId) {
		List<TaskDependency> stored = taskDependencyRepository.findByOwner_Id(ownerId);
		if (stored.isEmpty()) {
			return List.of();
		}
		Set<Long> blockerIds = new HashSet<>();
		for (TaskDependency dependency : stored) {
			blockerIds.add(dependency.getBlockerTaskId());
		}
		Map<Long, TaskStatus> blockerStatusById = new HashMap<>();
		for (Task blocker : findOwnedTasksByIds(ownerId, blockerIds)) {
			blockerStatusById.put(blocker.getId(), blocker.getStatus());
		}
		return stored.stream()
				.map(
						dependency ->
								new DependencyLink(
										dependency.getBlockerTaskId(),
										dependency.getBlockedTaskId(),
										isPlannable(blockerStatusById.get(dependency.getBlockerTaskId()))))
				.toList();
	}

	private static boolean isPlannable(TaskStatus status) {
		return status == TaskStatus.OPEN || status == TaskStatus.IN_PROGRESS;
	}
}
