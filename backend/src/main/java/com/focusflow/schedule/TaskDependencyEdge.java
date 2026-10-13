package com.focusflow.schedule;

public record TaskDependencyEdge(long blockerId, long blockedId) {}
