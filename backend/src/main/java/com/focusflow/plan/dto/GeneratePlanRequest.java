package com.focusflow.plan.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record GeneratePlanRequest(@NotNull LocalDate planDate, Long replacePlanId) {}
