package com.focusflow.plan;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DailyPlanBlockRepository extends JpaRepository<DailyPlanBlock, Long> {

	boolean existsByDailyPlanTask_TaskReference_IdAndOutcomeIsNotNull(Long taskReferenceId);
}
