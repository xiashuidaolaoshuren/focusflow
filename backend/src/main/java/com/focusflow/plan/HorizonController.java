package com.focusflow.plan;

import com.focusflow.plan.dto.HorizonResponse;
import java.time.LocalDate;
import java.time.LocalTime;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HorizonController {

	private final HorizonService horizonService;

	public HorizonController(HorizonService horizonService) {
		this.horizonService = horizonService;
	}

	@GetMapping("/api/horizon")
	public HorizonResponse horizon(
			@RequestParam(required = false) LocalDate currentDate,
			@RequestParam(required = false) LocalTime currentTime) {
		return horizonService.read(currentDate, currentTime);
	}
}
