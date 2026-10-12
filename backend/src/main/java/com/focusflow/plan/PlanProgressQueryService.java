package com.focusflow.plan;

import org.springframework.stereotype.Service;

/**
 * Cross-feature read facade over plan-recorded progress. The task feature asks this instead of
 * reaching into the plan repositories.
 */
@Service
public class PlanProgressQueryService {

	private final DailyPlanBlockRepository dailyPlanBlockRepository;

	public PlanProgressQueryService(DailyPlanBlockRepository dailyPlanBlockRepository) {
		this.dailyPlanBlockRepository = dailyPlanBlockRepository;
	}

	/** Whether any planned work block for the Task already carries a recorded outcome. */
	public boolean hasRecordedOutcome(Long taskId) {
		return dailyPlanBlockRepository
				.existsByDailyPlanTask_TaskReference_IdAndOutcomeIsNotNull(taskId);
	}
}
