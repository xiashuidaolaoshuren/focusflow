package com.focusflow.plan.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public record ReplanRequest(
		@NotNull LocalDate currentDate,
		@NotNull LocalTime cutoff,
		@NotNull Long expectedRevisionId,
		@NotNull List<TaskEffortVersion> effortVersions) {}
