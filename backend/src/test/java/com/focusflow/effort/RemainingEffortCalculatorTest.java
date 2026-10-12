package com.focusflow.effort;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class RemainingEffortCalculatorTest {

	private static final LocalDate MONDAY = LocalDate.of(2026, 10, 5);
	private static final LocalDate TUESDAY = LocalDate.of(2026, 10, 6);
	private static final Instant RECORDED_AT = Instant.parse("2026-10-05T10:00:00Z");

	@Test
	void apply_calculatorIsCallable() {
		AcceptedEffort result =
				(AcceptedEffort) RemainingEffortCalculator.apply(100, List.of());

		assertThat(result.remainingMinutes()).isEqualTo(100);
	}

	@Test
	void apply_partlyDoneCreditsActualMinutes() {
		EffortEvent.WorkCredit partlyDone =
				new EffortEvent.WorkCredit(
						MONDAY, RECORDED_AT, 1L, WorkOutcome.PARTLY_DONE, 50, 35);

		AcceptedEffort result =
				(AcceptedEffort) RemainingEffortCalculator.apply(100, List.of(partlyDone));

		assertThat(result.remainingMinutes()).isEqualTo(65);
	}

	@Test
	void apply_skippedCreditsZero() {
		EffortEvent.WorkCredit skipped =
				new EffortEvent.WorkCredit(
						MONDAY, RECORDED_AT, 1L, WorkOutcome.SKIPPED, 50, null);
		EffortEvent.WorkCredit done =
				new EffortEvent.WorkCredit(
						MONDAY,
						RECORDED_AT.plusSeconds(60),
						2L,
						WorkOutcome.DONE,
						30,
						null);

		AcceptedEffort result =
				(AcceptedEffort)
						RemainingEffortCalculator.apply(100, List.of(skipped, done));

		assertThat(result.remainingMinutes()).isEqualTo(70);
	}

	@Test
	void apply_checkpointReplacesRunningValue() {
		EffortEvent.Checkpoint checkpoint =
				new EffortEvent.Checkpoint(
						TUESDAY,
						Instant.parse("2026-10-06T09:00:00Z"),
						1L,
						90);
		EffortEvent.WorkCredit done =
				new EffortEvent.WorkCredit(
						TUESDAY,
						Instant.parse("2026-10-06T10:00:00Z"),
						2L,
						WorkOutcome.DONE,
						50,
						null);

		AcceptedEffort result =
				(AcceptedEffort)
						RemainingEffortCalculator.apply(100, List.of(checkpoint, done));

		assertThat(result.remainingMinutes()).isEqualTo(40);
	}

	@Test
	void apply_earlierDatedWorkDoesNotMoveCheckpoint() {
		EffortEvent.Checkpoint tuesdayCheckpoint =
				new EffortEvent.Checkpoint(
						TUESDAY,
						Instant.parse("2026-10-06T09:00:00Z"),
						1L,
						90);
		EffortEvent.WorkCredit mondayDone =
				new EffortEvent.WorkCredit(
						MONDAY,
						Instant.parse("2026-10-05T15:00:00Z"),
						2L,
						WorkOutcome.DONE,
						50,
						35);

		AcceptedEffort result =
				(AcceptedEffort)
						RemainingEffortCalculator.apply(
								100, List.of(tuesdayCheckpoint, mondayDone));

		assertThat(result.remainingMinutes()).isEqualTo(90);
	}

	@Test
	void apply_unknownEffortStaysUnknown() {
		AcceptedEffort unchanged =
				(AcceptedEffort) RemainingEffortCalculator.apply(null, List.of());
		assertThat(unchanged.remainingMinutes()).isNull();

		EffortEvent.WorkCredit done =
				new EffortEvent.WorkCredit(
						MONDAY, RECORDED_AT, 1L, WorkOutcome.DONE, 50, 35);
		AcceptedEffort afterCredit =
				(AcceptedEffort) RemainingEffortCalculator.apply(null, List.of(done));
		assertThat(afterCredit.remainingMinutes()).isNull();

		EffortEvent.Checkpoint unknownCheckpoint =
				new EffortEvent.Checkpoint(MONDAY, RECORDED_AT, 1L, null);
		AcceptedEffort afterUnknownCheckpoint =
				(AcceptedEffort)
						RemainingEffortCalculator.apply(null, List.of(unknownCheckpoint));
		assertThat(afterUnknownCheckpoint.remainingMinutes()).isNull();

		EffortEvent.Checkpoint knownCheckpoint =
				new EffortEvent.Checkpoint(MONDAY, RECORDED_AT, 1L, 90);
		AcceptedEffort afterKnownCheckpoint =
				(AcceptedEffort)
						RemainingEffortCalculator.apply(null, List.of(knownCheckpoint));
		assertThat(afterKnownCheckpoint.remainingMinutes()).isEqualTo(90);
	}

	@Test
	void apply_doneCreditsPlannedDuration() {
		EffortEvent.WorkCredit done =
				new EffortEvent.WorkCredit(
						MONDAY, RECORDED_AT, 1L, WorkOutcome.DONE, 50, 35);

		AcceptedEffort result =
				(AcceptedEffort) RemainingEffortCalculator.apply(100, List.of(done));

		assertThat(result.remainingMinutes()).isEqualTo(50);
	}
}
