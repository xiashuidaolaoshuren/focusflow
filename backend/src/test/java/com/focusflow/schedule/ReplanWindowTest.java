package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import org.junit.jupiter.api.Test;

class ReplanWindowTest {

	private static final LocalTime WINDOW_START = LocalTime.of(9, 0);
	private static final LocalTime WINDOW_END = LocalTime.of(18, 0);

	@Test
	void decide_whenCutoffIsBeforeWindowStart_clampsToStart() {
		CutoffDecision decision =
				ReplanWindow.decide(
						WINDOW_START, WINDOW_END, LocalTime.of(8, 30));

		assertThat(decision).isEqualTo(new CutoffDecision.Accepted(WINDOW_START));
	}

	@Test
	void decide_whenCutoffIsAtOrAfterWindowEnd_isRejected() {
		assertThat(ReplanWindow.decide(WINDOW_START, WINDOW_END, WINDOW_END))
				.isEqualTo(new CutoffDecision.Rejected());
		assertThat(ReplanWindow.decide(WINDOW_START, WINDOW_END, LocalTime.of(19, 0)))
				.isEqualTo(new CutoffDecision.Rejected());
	}

	@Test
	void decide_whenCutoffIsInteriorOrEqualToStart_isAcceptedUnchanged() {
		LocalTime interior = LocalTime.of(14, 0);
		assertThat(ReplanWindow.decide(WINDOW_START, WINDOW_END, interior))
				.isEqualTo(new CutoffDecision.Accepted(interior));
		assertThat(ReplanWindow.decide(WINDOW_START, WINDOW_END, WINDOW_START))
				.isEqualTo(new CutoffDecision.Accepted(WINDOW_START));
	}
}
