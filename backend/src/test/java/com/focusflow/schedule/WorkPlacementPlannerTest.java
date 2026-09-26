package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class WorkPlacementPlannerTest {

	private static final PlacementPolicy CADENCE_OFF =
			new PlacementPolicy(false, 50, 10, 15);

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
								null,
								1,
								1));
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
								null,
								1,
								1),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch",
								0,
								0));
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
								null,
								1,
								2),
						new ScheduledBlock(
								BlockKind.FIXED_BREAK,
								LocalTime.of(12, 0),
								LocalTime.of(13, 0),
								null,
								"Lunch",
								0,
								0),
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(13, 0),
								LocalTime.of(13, 20),
								7L,
								null,
								2,
								2));
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
								null,
								1,
								1));
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
								null,
								1,
								1));
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
								null,
								1,
								1),
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 30),
								LocalTime.of(9, 50),
								9L,
								null,
								1,
								1));
		assertThat(result.unplacedWork()).isEmpty();
	}
}
