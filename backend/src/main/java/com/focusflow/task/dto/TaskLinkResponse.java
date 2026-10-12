package com.focusflow.task.dto;

import com.focusflow.task.TaskStatus;

public record TaskLinkResponse(Long taskId, String title, TaskStatus status) {}
