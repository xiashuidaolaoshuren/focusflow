package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class SchedulePostconditionValidatorTest {

	private static final WorkWindow WINDOW =
			new WorkWindow(LocalTime.of(9, 0), LocalTime.of(18, 0));

	private static FreeIntervalPlan emptyStage1() {
		return new FreeIntervalPlan(List.of(), List.of(), 0, 0, 0);
	}

	private static void validate(PlacementResult result) {
		validate(emptyStage1(), List.of(), result);
	}

	private static void validate(
			FreeIntervalPlan stage1, List<RankedTask> ranking, PlacementResult result) {
		SchedulePostconditionValidator.validate(WINDOW, stage1, ranking, result);
	}

	@Test
	void validate_withValidEmptySchedule_doesNotThrow() {
		assertThatCode(() -> validate(new PlacementResult(List.of(), List.of())))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withNonMinuteAlignedStart_throwsNotMinuteAligned() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(9, 0, 30),
										LocalTime.of(10, 0),
										1L,
										null)),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.NOT_MINUTE_ALIGNED);
	}

	@Test
	void validate_withZeroDurationBlock_throwsNonPositiveDuration() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(9, 0),
										LocalTime.of(9, 0),
										1L,
										null)),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.NON_POSITIVE_DURATION);
	}

	@Test
	void validate_withInvertedInterval_throwsNonPositiveDuration() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(10, 0),
										LocalTime.of(9, 0),
										1L,
										null)),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.NON_POSITIVE_DURATION);
	}

	@Test
	void validate_withOutOfOrderBlocks_throwsOutOfOrder() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								workBlock(2L, LocalTime.of(11, 0), LocalTime.of(12, 0)),
								workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.OUT_OF_ORDER);
	}

	@Test
	void validate_withOverlappingBlocks_throwsOverlap() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0)),
								workBlock(2L, LocalTime.of(9, 30), LocalTime.of(10, 30))),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.OVERLAP);
	}

	@Test
	void validate_withBlockOutsideWindow_throwsOutOfWindow() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(8, 0), LocalTime.of(9, 0))),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.OUT_OF_WINDOW);
	}

	@Test
	void validate_withTouchingBlocksAndIdleGap_doesNotThrow() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0)),
								workBlock(2L, LocalTime.of(10, 0), LocalTime.of(11, 0)),
								workBlock(3L, LocalTime.of(12, 0), LocalTime.of(13, 0))),
						List.of());

		assertThatCode(
						() ->
								validate(
										emptyStage1(),
										List.of(
												new RankedTask(1L, 60),
												new RankedTask(2L, 60),
												new RankedTask(3L, 60)),
										result))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withMissingStageOneSegment_throwsStage1Mismatch() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						0,
						0,
						0);

		assertThatThrownBy(
						() ->
								validate(
										stage1,
										List.of(),
										new PlacementResult(List.of(), List.of())))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.STAGE1_MISMATCH);
	}

	@Test
	void validate_withExtraStageOneSegment_throwsStage1Mismatch() {
		FreeIntervalPlan stage1 = emptyStage1();
		PlacementResult result =
				new PlacementResult(
						List.of(
								labeledBlock(
										BlockKind.BUFFER,
										"Buffer",
										LocalTime.of(17, 0),
										LocalTime.of(18, 0))),
						List.of());

		assertThatThrownBy(() -> validate(stage1, List.of(), result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.STAGE1_MISMATCH);
	}

	@Test
	void validate_withRelabelledStageOneSegment_throwsStage1Mismatch() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						0,
						0,
						0);
		PlacementResult result =
				new PlacementResult(
						List.of(
								labeledBlock(
										BlockKind.FIXED_BREAK,
										"LUNCH",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						List.of());

		assertThatThrownBy(() -> validate(stage1, List.of(), result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.STAGE1_MISMATCH);
	}

	@Test
	void validate_withMatchingStageOneSegments_doesNotThrow() {
		FreeIntervalPlan stage1 =
				new FreeIntervalPlan(
						List.of(),
						List.of(
								new UnavailableSegment(
										UnavailableSegmentKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0)),
								new UnavailableSegment(
										UnavailableSegmentKind.BUFFER,
										"Buffer",
										LocalTime.of(17, 0),
										LocalTime.of(18, 0))),
						0,
						30,
						30);
		PlacementResult result =
				new PlacementResult(
						List.of(
								workBlock(1L, LocalTime.of(9, 0), LocalTime.of(12, 0)),
								labeledBlock(
										BlockKind.FIXED_BREAK,
										"Lunch",
										LocalTime.of(12, 0),
										LocalTime.of(13, 0)),
								workBlock(1L, LocalTime.of(13, 0), LocalTime.of(17, 0)),
								labeledBlock(
										BlockKind.BUFFER,
										"Buffer",
										LocalTime.of(17, 0),
										LocalTime.of(18, 0))),
						List.of());

		assertThatCode(() -> validate(stage1, List.of(new RankedTask(1L, 420)), result))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withConservedEstimate_doesNotThrow() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 30))),
						List.of());

		assertThatCode(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 90)),
										result))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withPartialPlacementAndOutOfTime_doesNotThrow() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of(new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, 30)));

		assertThatCode(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 90)),
										result))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withMissingWorkMinutes_throwsEstimateConservation() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of());

		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 90)),
										result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.ESTIMATE_CONSERVATION);
	}

	@Test
	void validate_withNonPositiveEstimate_throwsEstimateConservation() {
		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 0)),
										new PlacementResult(List.of(), List.of())))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.ESTIMATE_CONSERVATION);
	}

	@Test
	void validate_withNullOutOfTimeMinutes_throwsEstimateConservation() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of(new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, null)));

		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 90)),
										result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.ESTIMATE_CONSERVATION);
	}

	@Test
	void validate_withMissingNullEstimateTask_throwsTaskIdentity() {
		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, null)),
										new PlacementResult(List.of(), List.of())))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.TASK_IDENTITY);
	}

	@Test
	void validate_withDuplicateNoEstimateRows_throwsTaskIdentity() {
		PlacementResult result =
				new PlacementResult(
						List.of(),
						List.of(
								new UnplacedWork(1L, UnplacedReason.NO_ESTIMATE, null),
								new UnplacedWork(1L, UnplacedReason.NO_ESTIMATE, null)));

		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, null)),
										result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.TASK_IDENTITY);
	}

	@Test
	void validate_withUnknownWorkSourceId_throwsTaskIdentity() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(99L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of());

		assertThatThrownBy(
						() -> validate(emptyStage1(), List.of(), result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.TASK_IDENTITY);
	}

	@Test
	void validate_withNoEstimateWork_throwsTaskIdentity() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of(new UnplacedWork(1L, UnplacedReason.NO_ESTIMATE, null)));

		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, null)),
										result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.TASK_IDENTITY);
	}

	@Test
	void validate_withValidNoEstimateTask_doesNotThrow() {
		PlacementResult result =
				new PlacementResult(
						List.of(),
						List.of(new UnplacedWork(1L, UnplacedReason.NO_ESTIMATE, null)));

		assertThatCode(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, null)),
										result))
				.doesNotThrowAnyException();
	}

	@Test
	void validate_withDuplicateUnplacedRowsForPositiveEstimate_throwsTaskIdentity() {
		PlacementResult result =
				new PlacementResult(
						List.of(workBlock(1L, LocalTime.of(9, 0), LocalTime.of(10, 0))),
						List.of(
								new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, 10),
								new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, 10)));

		assertThatThrownBy(
						() ->
								validate(
										emptyStage1(),
										List.of(new RankedTask(1L, 70)),
										result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.TASK_IDENTITY);
	}

	private static ScheduledBlock workBlock(long taskId, LocalTime start, LocalTime end) {
		return new ScheduledBlock(BlockKind.WORK, start, end, taskId, null);
	}

	@Test
	void validate_withWorkBlockMissingSourceTaskId_throwsBlockShape() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(9, 0),
										LocalTime.of(10, 0),
										null,
										null)),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.BLOCK_SHAPE);
	}

	@Test
	void validate_withWorkBlockCarryingLabel_throwsBlockShape() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(9, 0),
										LocalTime.of(10, 0),
										1L,
										"Should not label work")),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.BLOCK_SHAPE);
	}

	@Test
	void validate_withNonWorkBlockMissingLabel_throwsBlockShape() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								labeledBlock(
										BlockKind.FIXED_BREAK,
										null,
										LocalTime.of(12, 0),
										LocalTime.of(13, 0))),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.BLOCK_SHAPE);
	}

	@Test
	void validate_withNonWorkBlockCarryingSourceTaskId_throwsBlockShape() {
		PlacementResult result =
				new PlacementResult(
						List.of(
								new ScheduledBlock(
										BlockKind.BUFFER,
										LocalTime.of(17, 0),
										LocalTime.of(18, 0),
										99L,
										"Buffer")),
						List.of());

		assertThatThrownBy(() -> validate(result))
				.isInstanceOf(SchedulePostconditionException.class)
				.extracting(
						ex -> ((SchedulePostconditionException) ex).violation())
				.isEqualTo(SchedulePostconditionViolation.BLOCK_SHAPE);
	}

	private static ScheduledBlock labeledBlock(
			BlockKind kind, String label, LocalTime start, LocalTime end) {
		return new ScheduledBlock(kind, start, end, null, label);
	}
}
