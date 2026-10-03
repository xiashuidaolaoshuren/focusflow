package com.focusflow.effort;

public sealed interface EffortAssessment permits AcceptedEffort {

	Integer remainingMinutes();
}

record AcceptedEffort(Integer remainingMinutes) implements EffortAssessment {}
