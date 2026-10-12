package com.focusflow.task;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.task.dto.TaskLinkResponse;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.user.User;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class TaskResponseMapper {

	private final TaskQueryService taskQueryService;

	public TaskResponseMapper(TaskQueryService taskQueryService) {
		this.taskQueryService = taskQueryService;
	}

	public TaskResponse toResponse(Task task) {
		if (task.getId() == null) {
			return baseResponse(task, List.of(), List.of());
		}
		User owner = task.getOwner();
		if (owner == null || owner.getId() == null) {
			return baseResponse(task, List.of(), List.of());
		}
		Long ownerId = owner.getId();
		List<DependencyLink> links = taskQueryService.findLinksByOwnerId(ownerId);
		Set<Long> linkedIds = linkedTaskIdsFor(task.getId(), links);
		Map<Long, Task> tasksById = loadTasksById(ownerId, linkedIds);
		return toResponse(task, links, tasksById);
	}

	public List<TaskResponse> toResponses(List<Task> tasks) {
		if (tasks.isEmpty()) {
			return List.of();
		}
		User owner = tasks.getFirst().getOwner();
		if (owner == null || owner.getId() == null) {
			return tasks.stream().map(this::toResponse).toList();
		}
		Long ownerId = owner.getId();
		List<DependencyLink> links = taskQueryService.findLinksByOwnerId(ownerId);
		Set<Long> linkedIds = new HashSet<>();
		for (Task task : tasks) {
			linkedIds.addAll(linkedTaskIdsFor(task.getId(), links));
		}
		Map<Long, Task> tasksById = loadTasksById(ownerId, linkedIds);
		return tasks.stream().map(task -> toResponse(task, links, tasksById)).toList();
	}

	private Map<Long, Task> loadTasksById(Long ownerId, Set<Long> linkedIds) {
		if (linkedIds.isEmpty()) {
			return Map.of();
		}
		Map<Long, Task> tasksById = new HashMap<>();
		for (Task linked : taskQueryService.findOwnedTasksByIds(ownerId, linkedIds)) {
			tasksById.put(linked.getId(), linked);
		}
		return tasksById;
	}

	private static Set<Long> linkedTaskIdsFor(long taskId, List<DependencyLink> links) {
		Set<Long> ids = new HashSet<>();
		for (DependencyLink link : links) {
			if (link.blockedId() == taskId) {
				ids.add(link.blockerId());
			}
			if (link.blockerId() == taskId) {
				ids.add(link.blockedId());
			}
		}
		return ids;
	}

	private TaskResponse toResponse(Task task, List<DependencyLink> links, Map<Long, Task> tasksById) {
		long taskId = task.getId();
		List<TaskLinkResponse> blockedBy = new ArrayList<>();
		List<TaskLinkResponse> blocks = new ArrayList<>();
		for (DependencyLink link : links) {
			if (link.blockedId() == taskId) {
				Task blocker = tasksById.get(link.blockerId());
				if (blocker != null) {
					blockedBy.add(toLinkResponse(blocker));
				}
			}
			if (link.blockerId() == taskId) {
				Task blocked = tasksById.get(link.blockedId());
				if (blocked != null) {
					blocks.add(toLinkResponse(blocked));
				}
			}
		}
		blockedBy.sort(Comparator.comparing(TaskLinkResponse::taskId));
		blocks.sort(Comparator.comparing(TaskLinkResponse::taskId));
		return baseResponse(task, blockedBy, blocks);
	}

	private static TaskResponse baseResponse(
			Task task, List<TaskLinkResponse> blockedBy, List<TaskLinkResponse> blocks) {
		return new TaskResponse(
				task.getId(),
				task.getTitle(),
				task.getDescription(),
				task.getPriority(),
				task.getStatus(),
				task.getDueDate(),
				task.getEstimatedMinutes(),
				task.getRemainingEffortMinutes(),
				task.getEffortVersion(),
				blockedBy,
				blocks);
	}

	private static TaskLinkResponse toLinkResponse(Task task) {
		return new TaskLinkResponse(task.getId(), task.getTitle(), task.getStatus());
	}
}
