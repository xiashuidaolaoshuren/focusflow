package com.focusflow.plan;

import com.focusflow.common.error.ConflictException;
import java.util.Optional;

final class PlanReplacePreconditions {

	private PlanReplacePreconditions() {}

	static void validateReplacePrecondition(Optional<DailyPlan> latestPlan, Long replacePlanId) {
		if (latestPlan.isPresent()) {
			DailyPlan plan = latestPlan.get();
			if (hasProgress(plan)) {
				throw new ConflictException("PLAN_HAS_PROGRESS", "plan has recorded progress");
			}
			if (replacePlanId == null) {
				throw new ConflictException("PLAN_EXISTS", "plan already exists");
			}
			if (!plan.getId().equals(replacePlanId)) {
				throw new ConflictException("PLAN_CHANGED", "plan has changed");
			}
		} else if (replacePlanId != null) {
			throw new ConflictException("PLAN_CHANGED", "plan has changed");
		}
	}

	static void rejectIfHasProgress(DailyPlan plan) {
		if (hasProgress(plan)) {
			throw new ConflictException("PLAN_HAS_PROGRESS", "plan has recorded progress");
		}
	}

	static boolean hasProgress(DailyPlan plan) {
		for (DailyPlanRevision revision : plan.getRevisions()) {
			for (DailyPlanBlock block : revision.getBlocks()) {
				if (block.getOutcome() != null) {
					return true;
				}
			}
		}
		return false;
	}
}
