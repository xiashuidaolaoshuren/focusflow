package com.focusflow.plan;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.dependency.InheritedAssignment;
import java.util.List;
import java.util.Map;

public record PlanDependencyCapture(
		List<DependencyLink> links,
		List<InheritedAssignment> assignments,
		Map<Long, Long> checkpointIdByTaskId) {}
