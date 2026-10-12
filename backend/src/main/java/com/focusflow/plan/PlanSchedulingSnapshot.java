package com.focusflow.plan;

final class PlanSchedulingSnapshot {

	private PlanSchedulingSnapshot() {}

	static boolean isComplete(DailyPlan plan) {
		return plan.getCadenceEnabled() != null
				&& plan.getTargetFocusMinutes() != null
				&& plan.getBreakMinutes() != null
				&& plan.getMinSessionMinutes() != null
				&& plan.getBufferMinutes() != null;
	}
}
