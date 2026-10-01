package com.focusflow.preferences;

import com.focusflow.preferences.dto.SchedulingPreferencesRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/scheduling-preferences")
public class SchedulingPreferencesController {

	private final SchedulingPreferencesService schedulingPreferencesService;

	public SchedulingPreferencesController(SchedulingPreferencesService schedulingPreferencesService) {
		this.schedulingPreferencesService = schedulingPreferencesService;
	}

	@GetMapping
	public SchedulingPreferencesResponse getEffective() {
		return schedulingPreferencesService.getEffective();
	}

	@PutMapping
	public SchedulingPreferencesResponse put(@Valid @RequestBody SchedulingPreferencesRequest request) {
		return schedulingPreferencesService.put(request);
	}
}
