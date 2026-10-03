package com.focusflow.plan.dto;

import com.focusflow.task.dto.TaskResponse;

public record BlockProgressResponse(TaskResponse task, DailyPlanResponse plan) {}
