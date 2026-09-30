package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;

import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class FreeIntervalPlannerTest {

	private static final WorkWindow WINDOW =
			new WorkWindow(LocalTime.of(9, 0), LocalTime.of(18, 0));

	@Test
	void plan_withNoUnavailableTime_returnsWholeWindowFree() {
		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, List.of(), List.of(), 0);

		assertThat(plan.freeIntervals())
				.containsExactly(
						new FreeInterval(LocalTime.of(9, 0), LocalTime.of(18, 0), false, false));
		assertThat(plan.unavailableSegments()).isEmpty();
		assertThat(plan.freeMinutes()).isEqualTo(540);
		assertThat(plan.requestedBufferMinutes()).isZero();
		assertThat(plan.realizedBufferMinutes()).isZero();
	}

	@Test
	void plan_withBreakAndCommitment_splitsWindowIntoOrderedIntervalsAndSegments() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Dentist", LocalTime.of(15, 0), LocalTime.of(16, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(
						tuple(LocalTime.of(9, 0), LocalTime.of(12, 0)),
						tuple(LocalTime.of(13, 0), LocalTime.of(15, 0)),
						tuple(LocalTime.of(16, 0), LocalTime.of(18, 0)));
		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT, "Dentist", LocalTime.of(15, 0), LocalTime.of(16, 0)));
		assertThat(plan.freeMinutes()).isEqualTo(420);
	}

	@Test
	void plan_clipsPartialUnavailableTimeAndIgnoresOutsideTheWindow() {
		List<FixedBreakWindow> breaks =
				List.of(
						new FixedBreakWindow("Early call", LocalTime.of(8, 0), LocalTime.of(10, 0)),
						new FixedBreakWindow("Before window", LocalTime.of(7, 0), LocalTime.of(8, 30)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Pickup", LocalTime.of(17, 0), LocalTime.of(19, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Early call", LocalTime.of(9, 0), LocalTime.of(10, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT, "Pickup", LocalTime.of(17, 0), LocalTime.of(18, 0)));
		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(tuple(LocalTime.of(10, 0), LocalTime.of(17, 0)));
		assertThat(plan.freeMinutes()).isEqualTo(420);
	}

	@Test
	void plan_whenUnavailableTimeCoversTheWholeWindow_returnsNoFreeIntervals() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Morning", LocalTime.of(9, 0), LocalTime.of(12, 0)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Offsite", LocalTime.of(12, 0), LocalTime.of(18, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.freeIntervals()).isEmpty();
		assertThat(plan.freeMinutes()).isZero();
		assertThat(plan.unavailableSegments()).hasSize(2);
	}

	@Test
	void plan_whenCommitmentOverlapsFixedBreak_commitmentWinsPrecedence() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Meeting", LocalTime.of(12, 30), LocalTime.of(13, 30)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Lunch", LocalTime.of(12, 0), LocalTime.of(12, 30)),
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT, "Meeting", LocalTime.of(12, 30), LocalTime.of(13, 30)));
		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(
						tuple(LocalTime.of(9, 0), LocalTime.of(12, 0)),
						tuple(LocalTime.of(13, 30), LocalTime.of(18, 0)));
		assertThat(plan.freeMinutes()).isEqualTo(450);
	}

	@Test
	void plan_whenCommitmentsUnsorted_normalizesFixedBreakAgainstMergedCommitments() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(9, 30), LocalTime.of(17, 30)));
		List<CommitmentWindow> commitments =
				List.of(
						new CommitmentWindow("Lunch meeting", LocalTime.of(12, 0), LocalTime.of(13, 0)),
						new CommitmentWindow("Morning standup", LocalTime.of(10, 0), LocalTime.of(11, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK,
								"Lunch",
								LocalTime.of(9, 30),
								LocalTime.of(10, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT,
								"Morning standup",
								LocalTime.of(10, 0),
								LocalTime.of(11, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK,
								"Lunch",
								LocalTime.of(11, 0),
								LocalTime.of(12, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT,
								"Lunch meeting",
								LocalTime.of(12, 0),
								LocalTime.of(13, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK,
								"Lunch",
								LocalTime.of(13, 0),
								LocalTime.of(17, 30)));
		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(
						tuple(LocalTime.of(9, 0), LocalTime.of(9, 30)),
						tuple(LocalTime.of(17, 30), LocalTime.of(18, 0)));
	}

	@Test
	void plan_whenCommitmentFullyCoversFixedBreak_breakEmitsNothing() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Coffee", LocalTime.of(12, 30), LocalTime.of(13, 30)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Workshop", LocalTime.of(12, 0), LocalTime.of(14, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.COMMITMENT, "Workshop", LocalTime.of(12, 0), LocalTime.of(14, 0)));
	}

	@Test
	void plan_whenAdjacentUnavailableTimeIsFixedBreak_marksBoundaryRestorative() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, List.of(), 0);

		assertThat(plan.freeIntervals())
				.containsExactly(
						new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, true),
						new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), true, false));
	}

	@Test
	void plan_whenAdjacentUnavailableTimeIsCommitment_doesNotMarkRestorative() {
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Meeting", LocalTime.of(12, 0), LocalTime.of(13, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, List.of(), commitments, 0);

		assertThat(plan.freeIntervals())
				.containsExactly(
						new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, false),
						new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), false, false));
	}

	@Test
	void plan_whenFixedBreakSitsAtWindowStart_marksFollowingIntervalRestorative() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Standup", LocalTime.of(9, 0), LocalTime.of(9, 30)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, List.of(), 0);

		assertThat(plan.freeIntervals())
				.containsExactly(new FreeInterval(LocalTime.of(9, 30), LocalTime.of(18, 0), true, false));
	}

	@Test
	void plan_whenGapBetweenIntervalsContainsBreakAndCommitment_marksRestorative() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Meeting", LocalTime.of(13, 0), LocalTime.of(14, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, commitments, 0);

		assertThat(plan.freeIntervals())
				.containsExactly(
						new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, true),
						new FreeInterval(LocalTime.of(14, 0), LocalTime.of(18, 0), true, false));
	}

	@Test
	void plan_withTrailingBuffer_reservesLatestFreeMinutesAsBuffer() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, List.of(), 60);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.BUFFER, "Buffer", LocalTime.of(17, 0), LocalTime.of(18, 0)));
		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(
						tuple(LocalTime.of(9, 0), LocalTime.of(12, 0)),
						tuple(LocalTime.of(13, 0), LocalTime.of(17, 0)));
		assertThat(plan.freeMinutes()).isEqualTo(420);
		assertThat(plan.requestedBufferMinutes()).isEqualTo(60);
		assertThat(plan.realizedBufferMinutes()).isEqualTo(60);
	}

	@Test
	void plan_withLargeTrailingBuffer_splitsAroundUnavailableTime() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, List.of(), 360);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.BUFFER, "Buffer", LocalTime.of(11, 0), LocalTime.of(12, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.BUFFER, "Buffer", LocalTime.of(13, 0), LocalTime.of(18, 0)));
		assertThat(plan.freeIntervals())
				.extracting(FreeInterval::start, FreeInterval::end)
				.containsExactly(tuple(LocalTime.of(9, 0), LocalTime.of(11, 0)));
		assertThat(plan.freeMinutes()).isEqualTo(120);
		assertThat(plan.requestedBufferMinutes()).isEqualTo(360);
		assertThat(plan.realizedBufferMinutes()).isEqualTo(360);
	}

	@Test
	void plan_whenTrailingBufferExceedsFreeTime_reservesAllOfIt() {
		List<FixedBreakWindow> breaks =
				List.of(new FixedBreakWindow("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)));

		FreeIntervalPlan plan = FreeIntervalPlanner.plan(WINDOW, breaks, List.of(), 500);

		assertThat(plan.unavailableSegments())
				.containsExactly(
						new UnavailableSegment(
								UnavailableSegmentKind.BUFFER, "Buffer", LocalTime.of(9, 0), LocalTime.of(12, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.FIXED_BREAK, "Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)),
						new UnavailableSegment(
								UnavailableSegmentKind.BUFFER, "Buffer", LocalTime.of(13, 0), LocalTime.of(18, 0)));
		assertThat(plan.freeIntervals()).isEmpty();
		assertThat(plan.freeMinutes()).isZero();
		assertThat(plan.requestedBufferMinutes()).isEqualTo(500);
		assertThat(plan.realizedBufferMinutes()).isEqualTo(480);
	}
}