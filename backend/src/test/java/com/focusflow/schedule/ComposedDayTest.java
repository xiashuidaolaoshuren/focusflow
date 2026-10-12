package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class ComposedDayTest {

	private static final LocalTime WINDOW_START = LocalTime.of(9, 0);

	@Test
	void compose_whenSingleRevisionWithNullCutoff_returnsUnclippedRail() {
		RevisionBlock work =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(9, 0),
						LocalTime.of(10, 0),
						10L,
						null,
						null,
						null,
						false,
						false);
		RevisionBlock lunch =
				new RevisionBlock(
						1,
						BlockKind.FIXED_BREAK,
						LocalTime.of(12, 0),
						LocalTime.of(13, 0),
						null,
						"Lunch",
						null,
						null,
						false,
						false);
		RevisionView revision = new RevisionView(1, null, List.of(work, lunch));

		ComposedDay composed = ComposedDay.compose(WINDOW_START, List.of(revision));

		assertThat(composed.rail())
				.extracting(
						RailSegment::revisionNumber,
						RailSegment::kind,
						RailSegment::start,
						RailSegment::end,
						RailSegment::sourceTaskId,
						RailSegment::label)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(
								1, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), 10L, null),
						org.assertj.core.groups.Tuple.tuple(
								1,
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch"));
		assertThat(composed.offRailEarlyCompletions()).isEmpty();
	}

	@Test
	void compose_whenMultipleRevisions_mergesHistoryAndLatestForwardBlocks() {
		RevisionBlock elapsedDone =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(9, 0),
						LocalTime.of(10, 0),
						10L,
						null,
						WorkOutcome.DONE,
						50,
						false,
						false);
		RevisionBlock supersededFuture =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(15, 0),
						LocalTime.of(16, 0),
						11L,
						null,
						null,
						null,
						false,
						false);
		RevisionView revision1 =
				new RevisionView(1, null, List.of(elapsedDone, supersededFuture));

		RevisionBlock forwardWork =
				new RevisionBlock(
						2,
						BlockKind.WORK,
						LocalTime.of(14, 0),
						LocalTime.of(15, 0),
						12L,
						null,
						null,
						null,
						false,
						false);
		RevisionBlock beforeCutoffOnLatest =
				new RevisionBlock(
						2,
						BlockKind.WORK,
						LocalTime.of(13, 0),
						LocalTime.of(13, 30),
						13L,
						null,
						null,
						null,
						false,
						false);
		RevisionView revision2 =
				new RevisionView(2, LocalTime.of(14, 0), List.of(beforeCutoffOnLatest, forwardWork));

		ComposedDay composed =
				ComposedDay.compose(WINDOW_START, List.of(revision1, revision2));

		assertThat(composed.rail())
				.extracting(
						RailSegment::revisionNumber,
						RailSegment::start,
						RailSegment::end,
						RailSegment::sourceTaskId)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(
								1, LocalTime.of(9, 0), LocalTime.of(10, 0), 10L),
						org.assertj.core.groups.Tuple.tuple(
								2, LocalTime.of(14, 0), LocalTime.of(15, 0), 12L));
		assertThat(composed.offRailEarlyCompletions()).isEmpty();
	}

	@Test
	void compose_whenOlderRevisionHasCrossingOrStraddlingBlocks_clipsOrOmitsAtBoundary() {
		LocalTime boundary = LocalTime.of(14, 0);
		RevisionBlock reconciledCrossing =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(13, 30),
						LocalTime.of(14, 30),
						10L,
						null,
						null,
						20,
						true,
						false);
		RevisionBlock unreconciledCrossing =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(13, 0),
						LocalTime.of(14, 15),
						11L,
						null,
						null,
						null,
						false,
						false);
		RevisionBlock straddlingBreak =
				new RevisionBlock(
						1,
						BlockKind.FIXED_BREAK,
						LocalTime.of(13, 45),
						LocalTime.of(14, 15),
						null,
						"Snack",
						null,
						null,
						false,
						false);
		RevisionView revision1 =
				new RevisionView(
						1, null, List.of(reconciledCrossing, unreconciledCrossing, straddlingBreak));

		RevisionBlock forward =
				new RevisionBlock(
						2,
						BlockKind.WORK,
						LocalTime.of(14, 0),
						LocalTime.of(15, 0),
						12L,
						null,
						null,
						null,
						false,
						false);
		RevisionView revision2 = new RevisionView(2, boundary, List.of(forward));

		ComposedDay composed =
				ComposedDay.compose(WINDOW_START, List.of(revision1, revision2));

		assertThat(composed.rail())
				.extracting(
						RailSegment::kind,
						RailSegment::start,
						RailSegment::end,
						RailSegment::actualMinutes,
						RailSegment::label)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(
								BlockKind.WORK,
								LocalTime.of(13, 30),
								boundary,
								20,
								null),
						org.assertj.core.groups.Tuple.tuple(
								BlockKind.FIXED_BREAK,
								LocalTime.of(13, 45),
								boundary,
								null,
								"Snack"),
						org.assertj.core.groups.Tuple.tuple(
								BlockKind.WORK,
								LocalTime.of(14, 0),
								LocalTime.of(15, 0),
								null,
								null));
	}

	@Test
	void compose_whenOlderRevisionHasEarlyCompletion_isOffRailAndExcludedFromSessionNumbering() {
		LocalTime boundary = LocalTime.of(14, 0);
		RevisionBlock earlyDone =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(15, 0),
						LocalTime.of(16, 0),
						10L,
						null,
						WorkOutcome.DONE,
						45,
						false,
						false);
		RevisionBlock alsoEarlySameTask =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(16, 30),
						LocalTime.of(17, 0),
						10L,
						null,
						WorkOutcome.PARTLY_DONE,
						20,
						false,
						false);
		RevisionView revision1 = new RevisionView(1, null, List.of(earlyDone, alsoEarlySameTask));

		RevisionBlock forward =
				new RevisionBlock(
						2,
						BlockKind.WORK,
						LocalTime.of(14, 0),
						LocalTime.of(15, 0),
						10L,
						null,
						null,
						null,
						false,
						false);
		RevisionView revision2 = new RevisionView(2, boundary, List.of(forward));

		ComposedDay composed =
				ComposedDay.compose(WINDOW_START, List.of(revision1, revision2));

		assertThat(composed.offRailEarlyCompletions()).containsExactly(earlyDone, alsoEarlySameTask);
		assertThat(composed.rail())
				.extracting(
						RailSegment::start,
						RailSegment::end,
						RailSegment::sessionIndex,
						RailSegment::sessionCount)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(
								LocalTime.of(14, 0), LocalTime.of(15, 0), 1, 1));
	}

	@Test
	void compose_dayActuals_countKnownMissingAndExcludeSupersededOrSkipped() {
		LocalTime boundary = LocalTime.of(14, 0);
		RevisionBlock knownDone =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(9, 0),
						LocalTime.of(10, 0),
						10L,
						null,
						WorkOutcome.DONE,
						50,
						false,
						false);
		RevisionBlock missingDone =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(10, 0),
						LocalTime.of(11, 0),
						11L,
						null,
						WorkOutcome.DONE,
						null,
						false,
						false);
		RevisionBlock skipped =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(11, 0),
						LocalTime.of(12, 0),
						12L,
						null,
						WorkOutcome.SKIPPED,
						null,
						false,
						false);
		RevisionBlock superseded =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(15, 0),
						LocalTime.of(16, 0),
						13L,
						null,
						null,
						null,
						false,
						false);
		RevisionBlock reconciledZero =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(13, 30),
						LocalTime.of(14, 30),
						14L,
						null,
						null,
						0,
						true,
						false);
		RevisionBlock earlyDone =
				new RevisionBlock(
						1,
						BlockKind.WORK,
						LocalTime.of(16, 0),
						LocalTime.of(17, 0),
						15L,
						null,
						WorkOutcome.DONE,
						null,
						false,
						false);
		RevisionView revision1 =
				new RevisionView(
						1,
						null,
						List.of(
								knownDone,
								missingDone,
								skipped,
								superseded,
								reconciledZero,
								earlyDone));

		RevisionBlock forward =
				new RevisionBlock(
						2,
						BlockKind.WORK,
						LocalTime.of(14, 0),
						LocalTime.of(15, 0),
						16L,
						null,
						null,
						null,
						false,
						false);
		RevisionView revision2 = new RevisionView(2, boundary, List.of(forward));

		ComposedDay composed =
				ComposedDay.compose(WINDOW_START, List.of(revision1, revision2));

		assertThat(composed.actuals().knownActualMinutes()).isEqualTo(50);
		assertThat(composed.actuals().missingActualCount()).isEqualTo(2);
	}
}
