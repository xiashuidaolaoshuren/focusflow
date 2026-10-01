package com.focusflow.testsupport;

import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.ScheduledBlockResponse;
import com.focusflow.plan.dto.UnplacedWorkResponse;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class DailyPlanResponseTestSupport {

	private DailyPlanResponseTestSupport() {}

	public static DailyPlanResponse minimal(
			Long id, LocalDate planDate, Instant createdAt, DailyPlanWarning warning) {
		return new DailyPlanResponse(
				id,
				planDate,
				createdAt,
				LocalTime.of(9, 0),
				LocalTime.of(18, 0),
				null,
				null,
				480,
				0,
				0L,
				0,
				0,
				warning,
				List.of(),
				List.of());
	}

	public static DailyPlanResponse withBlocksAndUnplaced(
			Long id,
			LocalDate planDate,
			Instant createdAt,
			List<ScheduledBlockResponse> blocks,
			List<UnplacedWorkResponse> unplacedWork) {
		return new DailyPlanResponse(
				id,
				planDate,
				createdAt,
				LocalTime.of(9, 0),
				LocalTime.of(18, 0),
				null,
				null,
				480,
				120,
				90L,
				0,
				0,
				null,
				blocks,
				unplacedWork);
	}
}
