package com.focusflow.plan;

import com.focusflow.dependency.RankingGroup;

final class PlanMustIncludeRules {

	private PlanMustIncludeRules() {}

	static boolean isInheritedMustInclude(RankingGroup group) {
		return group != RankingGroup.OPTIONAL;
	}

	static boolean isShortfallContributor(DailyPlanTask planTask) {
		return planTask.isMustInclude() && planTask.getUnplacedReason() != null;
	}
}
