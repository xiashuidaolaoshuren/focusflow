package com.focusflow.task;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class TaskQueryService {

	private final TaskRepository taskRepository;
	private final UnplannedWorkRepository unplannedWorkRepository;

	public TaskQueryService(
			TaskRepository taskRepository, UnplannedWorkRepository unplannedWorkRepository) {
		this.taskRepository = taskRepository;
		this.unplannedWorkRepository = unplannedWorkRepository;
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
}
