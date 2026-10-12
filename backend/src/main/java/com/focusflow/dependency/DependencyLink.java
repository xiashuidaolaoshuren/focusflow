package com.focusflow.dependency;

public record DependencyLink(long blockerId, long blockedId, boolean blockerPlannable) {}
