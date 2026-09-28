package com.focusflow.plan.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record GeneratePlanRequest(
		@NotNull @Min(1) Integer availableMinutes,
		@NotNull LocalDate planDate,
		Long replacePlanId) {}
