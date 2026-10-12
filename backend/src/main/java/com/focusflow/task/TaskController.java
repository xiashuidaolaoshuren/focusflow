package com.focusflow.task;

import com.focusflow.task.dto.AddBlockerRequest;
import com.focusflow.task.dto.CreateTaskRequest;
import com.focusflow.task.dto.RemainingEffortRequest;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.task.dto.UpdateTaskRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

	private final TaskService taskService;
	private final TaskDependencyService taskDependencyService;

	public TaskController(TaskService taskService, TaskDependencyService taskDependencyService) {
		this.taskService = taskService;
		this.taskDependencyService = taskDependencyService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public TaskResponse create(@Valid @RequestBody CreateTaskRequest request) {
		return taskService.create(request);
	}

	@GetMapping
	public List<TaskResponse> list() {
		return taskService.listForCurrentUser();
	}

	@GetMapping("/{id}")
	public TaskResponse getById(@PathVariable Long id) {
		return taskService.getForCurrentUser(id);
	}

	@PutMapping("/{id}")
	public TaskResponse update(
			@PathVariable Long id, @Valid @RequestBody UpdateTaskRequest request) {
		return taskService.updateForCurrentUser(id, request);
	}

	@PostMapping("/{id}/remaining-effort")
	public TaskResponse reassessRemainingEffort(
			@PathVariable Long id, @Valid @RequestBody RemainingEffortRequest request) {
		return taskService.reassessRemainingEffortForCurrentUser(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		taskService.deleteForCurrentUser(id);
	}

	@PostMapping("/{id}/blockers")
	public TaskResponse addBlocker(
			@PathVariable Long id, @Valid @RequestBody AddBlockerRequest request) {
		return taskDependencyService.addBlocker(id, request.blockerTaskId());
	}

	@DeleteMapping("/{id}/blockers/{blockerId}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void removeBlocker(@PathVariable Long id, @PathVariable Long blockerId) {
		taskDependencyService.removeBlocker(id, blockerId);
	}
}
