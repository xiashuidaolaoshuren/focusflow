package com.focusflow.plan;

import com.focusflow.common.error.ConflictException;
import java.util.Optional;

final class PlanReplacePreconditions {

	private PlanReplacePreconditions() {}

	static void validateReplacePrecondition(Optional<DailyPlan> latestPlan, Long replacePlanId) {
		if (latestPlan.isPresent()) {
			if (replacePlanId == null) {
				throw new ConflictException("PLAN_EXISTS", "plan already exists");
			}
			if (!latestPlan.get().getId().equals(replacePlanId)) {
				throw new ConflictException("PLAN_CHANGED", "plan has changed");
			}
		} else if (replacePlanId != null) {
			throw new ConflictException("PLAN_CHANGED", "plan has changed");
		}
	}
}
