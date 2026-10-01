package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class WorkPlacementPlannerTest {

	private static final PlacementPolicy CADENCE_OFF =
			new PlacementPolicy(false, 50, 10, 15);

	private static final PlacementPolicy CADENCE_ON =
			new PlacementPolicy(true, 50, 10, 15);

	private static FreeIntervalPlan wholeWindow() {
		return new FreeIntervalPlan(
				List.of(new FreeInterval(LocalTime.of(9, 0), LocalTime.of(18, 0), false, false)),
				List.of(),
				540,
				0,
				0);
	}

	@Test
	void place_withOneFittingTask_placesSingleWorkBlock() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 90));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(10, 30),
								7L,
								null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_copiesStageOneUnavailableSegmentsIntoBlocks() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, true),
								new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), true, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						420,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 60));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(10, 0),
								7L,
								null),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch"));
	}

	@Test
	void place_withLunchBreak_continuesInNextFreeInterval() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, true),
								new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), true, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						420,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 200));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(12, 0),
								7L,
								null),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch"),
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(13, 0),
								LocalTime.of(13, 20),
								7L,
								null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withNullEstimate_emitsNoEstimateWithoutConsumingClockTime() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking =
				List.of(new RankedTask(7L, null), new RankedTask(9L, 30));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.NO_ESTIMATE, null));
		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(9, 30),
								9L,
								null));
	}

	@Test
	void place_whenEstimateExceedsFreeTime_emitsOutOfTimeForRemainder() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(new FreeInterval(LocalTime.of(9, 0), LocalTime.of(10, 0), false, false)),
						List.of(),
						60,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 90));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(10, 0),
								7L,
								null));
		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.OUT_OF_TIME, 30));
	}

	@Test
	void place_withNoFreeIntervals_unplacesEntireEstimate() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(List.of(), List.of(), 0, 0, 0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 90));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks()).isEmpty();
		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.OUT_OF_TIME, 90));
	}

	@Test
	void place_withMultipleTasks_followsRankingOrderWithoutReordering() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 30), new RankedTask(9L, 20));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(9, 30),
								7L,
								null),
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 30),
								LocalTime.of(9, 50),
								9L,
								null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_splitsLongTaskIntoSessionsWithBreaks() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 120));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(9, 50),
								LocalTime.of(10, 0),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(10, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(10, 50),
								LocalTime.of(11, 0),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(11, 0), LocalTime.of(11, 20), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_whenWindowExhausts_emitsOutOfTimeRemainder() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(new FreeInterval(LocalTime.of(9, 0), LocalTime.of(11, 50), false, false)),
						List.of(),
						170,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 160));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(9, 50),
								LocalTime.of(10, 0),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(10, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(10, 50),
								LocalTime.of(11, 0),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(11, 0), LocalTime.of(11, 50), 7L, null));
		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.OUT_OF_TIME, 10));
	}

	@Test
	void place_withCadenceOn_skipsIntervalShorterThanMinSession() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(10, 0), false, true),
								new FreeInterval(LocalTime.of(11, 50), LocalTime.of(12, 0), true, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(10, 0),
										LocalTime.of(11, 50))),
						70,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 90));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(10, 0),
								LocalTime.of(11, 50),
								null,
								"Lunch"));
		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.OUT_OF_TIME, 40));
	}

	@Test
	void place_withCadenceOn_whenNothingFollowsBreak_leavesSliverIdle() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(new FreeInterval(LocalTime.of(9, 0), LocalTime.of(10, 0), false, false)),
						List.of(),
						60,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 80));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), 7L, null));
		assertThat(result.unplacedWork())
				.containsExactly(new UnplacedWork(7L, UnplacedReason.OUT_OF_TIME, 30));
	}

	@Test
	void place_withCadenceOn_absorbsShortFinalTailIntoCurrentSession() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 113));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 50), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(9, 50),
								LocalTime.of(10, 0),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(11, 3), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_absorbsSingleSessionTail() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 55));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 55), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_takesEarlyBreakWhenBudgetTooShortForNewTask() {
		FreeIntervalPlan stage1 = wholeWindow();
		List<RankedTask> ranking = List.of(new RankedTask(7L, 40), new RankedTask(9L, 30));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 40), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(9, 40),
								LocalTime.of(9, 50),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 50), LocalTime.of(10, 20), 9L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_crossingFixedBreakResetsFocusClock() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, true),
								new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), true, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						480,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 200));
		PlacementPolicy cadence90 = new PlacementPolicy(true, 90, 10, 15);

		PlacementResult result = WorkPlacementPlanner.place(stage1, ranking, cadence90);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 30), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(10, 30),
								LocalTime.of(10, 40),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 40), LocalTime.of(12, 0), 7L, null),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(13, 0), LocalTime.of(13, 30), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_withCadenceOn_crossingCommitmentPreservesFocusClock() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(12, 0), false, false),
								new FreeInterval(LocalTime.of(13, 0), LocalTime.of(18, 0), false, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										"Meeting",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						480,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 200));
		PlacementPolicy cadence90 = new PlacementPolicy(true, 90, 10, 15);

		PlacementResult result = WorkPlacementPlanner.place(stage1, ranking, cadence90);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 30), 7L, null),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(10, 30),
								LocalTime.of(10, 40),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 40), LocalTime.of(12, 0), 7L, null),
						new ScheduledBlock(
								BlockKind.COMMITMENT,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Meeting"),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(13, 0),
								LocalTime.of(13, 10),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(13, 10), LocalTime.of(13, 40), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_whenEarlyBreakDoesNotFit_leavesSliverIdleAcrossCommitment() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(9, 45), false, false),
								new FreeInterval(LocalTime.of(10, 15), LocalTime.of(18, 0), false, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										"Appt",
										LocalTime.of(9, 45),
										LocalTime.of(10, 15))),
						495,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 40), new RankedTask(9L, 30));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 40), 7L, null),
						new ScheduledBlock(
								BlockKind.COMMITMENT,
								LocalTime.of(9, 45),
								LocalTime.of(10, 15),
								null,
								"Appt"),
						new ScheduledBlock(
								BlockKind.CADENCE_BREAK,
								LocalTime.of(10, 15),
								LocalTime.of(10, 25),
								null,
								"Cadence break"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 25), LocalTime.of(10, 55), 9L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_whenEarlyBreakDoesNotFit_fixedBreakResetsCadenceAtBoundary() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(9, 45), false, true),
								new FreeInterval(LocalTime.of(10, 15), LocalTime.of(18, 0), true, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(9, 45),
										LocalTime.of(10, 15))),
						495,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 40), new RankedTask(9L, 30));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_ON);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(9, 40), 7L, null),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(9, 45),
								LocalTime.of(10, 15),
								null,
								"Lunch"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 15), LocalTime.of(10, 45), 9L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_cadenceOff_leavesNonFinalShortSessionIdle() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(10, 10), false, false),
								new FreeInterval(LocalTime.of(10, 30), LocalTime.of(10, 38), false, false),
								new FreeInterval(LocalTime.of(11, 0), LocalTime.of(18, 0), false, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										"Call",
										LocalTime.of(10, 10),
										LocalTime.of(10, 30)),
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										"Standup",
										LocalTime.of(10, 38),
										LocalTime.of(11, 0))),
						498,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 100));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 10), 7L, null),
						new ScheduledBlock(
								BlockKind.COMMITMENT,
								LocalTime.of(10, 10),
								LocalTime.of(10, 30),
								null,
								"Call"),
						new ScheduledBlock(
								BlockKind.COMMITMENT,
								LocalTime.of(10, 38),
								LocalTime.of(11, 0),
								null,
								"Standup"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(11, 0), LocalTime.of(11, 30), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}

	@Test
	void place_cadenceOff_placesFinalRemainderShorterThanMinSession() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(
								new FreeInterval(LocalTime.of(9, 0), LocalTime.of(10, 10), false, false),
								new FreeInterval(LocalTime.of(10, 30), LocalTime.of(18, 0), false, false)),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										"Call",
										LocalTime.of(10, 10),
										LocalTime.of(10, 30))),
						520,
						0,
						0);
		List<RankedTask> ranking = List.of(new RankedTask(7L, 80));

		PlacementResult result =
				WorkPlacementPlanner.place(stage1, ranking, CADENCE_OFF);

		assertThat(result.blocks())
				.containsExactly(
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 10), 7L, null),
						new ScheduledBlock(
								BlockKind.COMMITMENT,
								LocalTime.of(10, 10),
								LocalTime.of(10, 30),
								null,
								"Call"),
						new ScheduledBlock(
								BlockKind.WORK, LocalTime.of(10, 30), LocalTime.of(10, 40), 7L, null));
		assertThat(result.unplacedWork()).isEmpty();
	}
}
