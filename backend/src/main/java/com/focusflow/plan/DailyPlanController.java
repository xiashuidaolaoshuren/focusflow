package com.focusflow.plan;

import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.GeneratePlanRequest;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import java.time.LocalDate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/daily-plans")
public class DailyPlanController {

	private final DailyPlanService dailyPlanService;

	public DailyPlanController(DailyPlanService dailyPlanService) {
		this.dailyPlanService = dailyPlanService;
	}

	@GetMapping
	public PageResponse<DailyPlanSummaryResponse> list(
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		return dailyPlanService.listForCurrentUser(page, size);
	}

	@GetMapping("/by-date")
	@ApiResponses({
		@ApiResponse(responseCode = "200", description = "Plan found for the requested date"),
		@ApiResponse(responseCode = "204", description = "No plan for the requested date")
	})
	public ResponseEntity<DailyPlanResponse> byDate(
			@RequestParam(required = false) LocalDate planDate) {
		return dailyPlanService
				.byDateForCurrentUser(planDate)
				.map(ResponseEntity::ok)
				.orElseGet(() -> ResponseEntity.noContent().build());
	}

	@GetMapping("/{id}")
	public DailyPlanResponse getById(@PathVariable Long id) {
		return dailyPlanService.getForCurrentUser(id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void delete(@PathVariable Long id) {
		dailyPlanService.deleteForCurrentUser(id);
	}

	@PostMapping("/generate")
	@ResponseStatus(HttpStatus.CREATED)
	public DailyPlanResponse generate(@Valid @RequestBody GeneratePlanRequest request) {
		return dailyPlanService.generate(request);
	}
}
