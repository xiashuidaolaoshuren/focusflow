package com.focusflow.effort;

public sealed interface EffortAssessment permits AcceptedEffort {}

record AcceptedEffort(Integer remainingMinutes) implements EffortAssessment {}
