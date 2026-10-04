package com.focusflow.plan.dto;

import jakarta.validation.constraints.NotNull;

public record TaskEffortVersion(@NotNull Long taskId, int effortVersion) {}
