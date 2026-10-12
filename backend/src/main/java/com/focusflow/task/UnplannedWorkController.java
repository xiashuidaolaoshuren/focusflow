package com.focusflow.task;

import com.focusflow.task.dto.UnplannedWorkRequest;
import com.focusflow.task.dto.UnplannedWorkResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/unplanned-work")
public class UnplannedWorkController {

	private final UnplannedWorkService unplannedWorkService;

	public UnplannedWorkController(UnplannedWorkService unplannedWorkService) {
		this.unplannedWorkService = unplannedWorkService;
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	public UnplannedWorkResponse create(@RequestBody UnplannedWorkRequest request) {
		return unplannedWorkService.create(request);
	}

	@PutMapping("/{id}")
	public UnplannedWorkResponse correct(
			@PathVariable Long id, @RequestBody UnplannedWorkRequest request) {
		return unplannedWorkService.correct(id, request);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(
			@PathVariable Long id, @RequestParam(required = false) Integer effortVersion) {
		unplannedWorkService.delete(id, effortVersion);
	}
}
