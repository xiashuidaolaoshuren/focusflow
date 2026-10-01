package com.focusflow.plan.dto;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class DailyPlanSummaryResponseTest {

	@Test
	void exposesSummaryFields() {
		DailyPlanSummaryResponse response =
				new DailyPlanSummaryResponse(
						1L,
						LocalDate.of(2026, 6, 1),
						Instant.parse("2026-06-01T09:00:00Z"),
						120,
						2,
						2,
						1,
						true);

		assertThat(response.id()).isEqualTo(1L);
		assertThat(response.planDate()).isEqualTo(LocalDate.of(2026, 6, 1));
		assertThat(response.createdAt()).isEqualTo(Instant.parse("2026-06-01T09:00:00Z"));
		assertThat(response.scheduledWorkMinutes()).isEqualTo(120);
		assertThat(response.workSessionCount()).isEqualTo(2);
		assertThat(response.scheduledTaskCount()).isEqualTo(2);
		assertThat(response.unplacedWorkCount()).isEqualTo(1);
		assertThat(response.hasWarning()).isTrue();
	}
}
