package com.focusflow.task.dto;

import jakarta.validation.constraints.NotNull;

public record AddBlockerRequest(@NotNull Long blockerTaskId) {}
