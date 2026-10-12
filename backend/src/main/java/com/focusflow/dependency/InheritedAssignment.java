package com.focusflow.dependency;

import java.time.LocalDate;

public record InheritedAssignment(
		long taskId, RankingGroup group, LocalDate inheritedDueDate, long neededForTaskId) {}
