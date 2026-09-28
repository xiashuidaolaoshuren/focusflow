package com.focusflow.plan;

import java.time.Instant;
import java.time.LocalDate;

public interface DailyPlanSummaryProjection {

	Long getId();

	LocalDate getPlanDate();

	Instant getCreatedAt();

	Integer getScheduledWorkMinutes();

	Integer getWorkSessionCount();

	Integer getScheduledTaskCount();

	Integer getUnplacedWorkCount();

	Boolean getHasWarning();
}
