package com.focusflow.schedule;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class SchedulePostconditionValidator {

	private SchedulePostconditionValidator() {}

	public static void validate(
			WorkWindow window,
			FreeIntervalPlan stage1,
			List<RankedTask> ranking,
			PlacementResult result) {
		List<ScheduledBlock> blocks = result.blocks();
		validateWellFormedBlocks(blocks);
		validateTimeline(window, blocks);
		validateStage1Segments(stage1, blocks);
		validateEstimateConservation(ranking, result);
		validateTaskIdentity(ranking, result);
	}

	private record StageOneSegmentKey(
			BlockKind kind, String label, LocalTime start, LocalTime end) {}

	private static final Comparator<StageOneSegmentKey> STAGE_ONE_SEGMENT_ORDER =
			Comparator.comparing(StageOneSegmentKey::kind)
					.thenComparing(StageOneSegmentKey::label)
					.thenComparing(StageOneSegmentKey::start)
					.thenComparing(StageOneSegmentKey::end);

	private static void validateWellFormedBlocks(List<ScheduledBlock> blocks) {
		for (ScheduledBlock block : blocks) {
			if (!isMinuteAligned(block.start()) || !isMinuteAligned(block.end())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.NOT_MINUTE_ALIGNED,
						"block times must be minute-aligned");
			}
			if (!block.start().isBefore(block.end())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.NON_POSITIVE_DURATION,
						"block start must be before end");
			}
		}
	}

	private static boolean isMinuteAligned(LocalTime time) {
		return time.getSecond() == 0 && time.getNano() == 0;
	}

	private static void validateTimeline(WorkWindow window, List<ScheduledBlock> blocks) {
		for (ScheduledBlock block : blocks) {
			if (block.start().isBefore(window.start()) || block.end().isAfter(window.end())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.OUT_OF_WINDOW,
						"block must stay inside the work window");
			}
		}
		for (int index = 0; index < blocks.size() - 1; index++) {
			ScheduledBlock current = blocks.get(index);
			ScheduledBlock next = blocks.get(index + 1);
			if (current.start().isAfter(next.start())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.OUT_OF_ORDER,
						"blocks must be ordered by start time");
			}
			if (current.end().isAfter(next.start())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.OVERLAP,
						"blocks must not overlap");
			}
		}
	}

	private static void validateStage1Segments(
			FreeIntervalPlan stage1, List<ScheduledBlock> blocks) {
		List<StageOneSegmentKey> expected = new ArrayList<>();
		for (UnavailableSegment segment : stage1.unavailableSegments()) {
			expected.add(
					new StageOneSegmentKey(
							toBlockKind(segment.kind()),
							segment.label(),
							segment.start(),
							segment.end()));
		}
		expected.sort(STAGE_ONE_SEGMENT_ORDER);

		List<StageOneSegmentKey> actual = new ArrayList<>();
		for (ScheduledBlock block : blocks) {
			if (isStageOneBlockKind(block.kind())) {
				actual.add(
						new StageOneSegmentKey(
								block.kind(), block.label(), block.start(), block.end()));
			}
		}
		actual.sort(STAGE_ONE_SEGMENT_ORDER);

		if (!expected.equals(actual)) {
			throw new SchedulePostconditionException(
					SchedulePostconditionViolation.STAGE1_MISMATCH,
					"stage 1 unavailable segments must appear exactly once");
		}
	}

	private static boolean isStageOneBlockKind(BlockKind kind) {
		return kind == BlockKind.FIXED_BREAK
				|| kind == BlockKind.COMMITMENT
				|| kind == BlockKind.BUFFER;
	}

	private static BlockKind toBlockKind(UnavailableSegmentKind kind) {
		return switch (kind) {
			case FIXED_BREAK -> BlockKind.FIXED_BREAK;
			case COMMITMENT -> BlockKind.COMMITMENT;
			case BUFFER -> BlockKind.BUFFER;
		};
	}

	private static void validateEstimateConservation(
			List<RankedTask> ranking, PlacementResult result) {
		for (RankedTask task : ranking) {
			Integer estimate = task.estimatedMinutes();
			if (estimate == null) {
				continue;
			}
			if (estimate <= 0) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.ESTIMATE_CONSERVATION,
						"positive-estimate tasks must have a positive estimate");
			}

			List<UnplacedWork> unplacedForTask =
					result.unplacedWork().stream()
							.filter(unplaced -> unplaced.sourceTaskId() == task.sourceTaskId())
							.toList();
			if (unplacedForTask.size() > 1) {
				continue;
			}

			int scheduledMinutes = sumWorkMinutes(result.blocks(), task.sourceTaskId());
			int unplacedMinutes = 0;
			if (unplacedForTask.size() == 1) {
				UnplacedWork unplaced = unplacedForTask.get(0);
				if (unplaced.reason() == UnplacedReason.OUT_OF_TIME) {
					if (unplaced.unplacedMinutes() == null) {
						throw new SchedulePostconditionException(
								SchedulePostconditionViolation.ESTIMATE_CONSERVATION,
								"OUT_OF_TIME remainder must include minutes");
					}
					unplacedMinutes = unplaced.unplacedMinutes();
				} else {
					throw new SchedulePostconditionException(
							SchedulePostconditionViolation.ESTIMATE_CONSERVATION,
							"positive-estimate tasks may only be unplaced as OUT_OF_TIME");
				}
			}

			if (scheduledMinutes + unplacedMinutes != estimate) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.ESTIMATE_CONSERVATION,
						"scheduled work plus unplaced minutes must equal the estimate");
			}
		}
	}

	private static int sumWorkMinutes(List<ScheduledBlock> blocks, long sourceTaskId) {
		int total = 0;
		for (ScheduledBlock block : blocks) {
			if (block.kind() == BlockKind.WORK && sourceTaskId == block.sourceTaskId()) {
				total += minutesBetween(block.start(), block.end());
			}
		}
		return total;
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}

	private static void validateTaskIdentity(List<RankedTask> ranking, PlacementResult result) {
		Set<Long> rankedIds = new HashSet<>();
		for (RankedTask task : ranking) {
			rankedIds.add(task.sourceTaskId());
		}

		for (ScheduledBlock block : result.blocks()) {
			if (block.kind() == BlockKind.WORK
					&& block.sourceTaskId() != null
					&& !rankedIds.contains(block.sourceTaskId())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.TASK_IDENTITY,
						"work blocks must reference ranked tasks");
			}
		}

		for (UnplacedWork unplaced : result.unplacedWork()) {
			if (!rankedIds.contains(unplaced.sourceTaskId())) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.TASK_IDENTITY,
						"unplaced work must reference ranked tasks");
			}
		}

		for (RankedTask task : ranking) {
			long sourceTaskId = task.sourceTaskId();
			boolean hasWork = hasWorkForTask(result.blocks(), sourceTaskId);
			List<UnplacedWork> unplacedForTask =
					result.unplacedWork().stream()
							.filter(unplaced -> unplaced.sourceTaskId() == sourceTaskId)
							.toList();

			if (unplacedForTask.size() > 1) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.TASK_IDENTITY,
						"each ranked task may appear at most once in unplaced work");
			}

			if (task.estimatedMinutes() == null) {
				if (hasWork) {
					throw new SchedulePostconditionException(
							SchedulePostconditionViolation.TASK_IDENTITY,
							"unestimated tasks must not have scheduled work");
				}
				if (unplacedForTask.size() != 1
						|| unplacedForTask.get(0).reason() != UnplacedReason.NO_ESTIMATE) {
					throw new SchedulePostconditionException(
							SchedulePostconditionViolation.TASK_IDENTITY,
							"unestimated tasks must have exactly one NO_ESTIMATE row");
				}
				continue;
			}

			if (!hasWork && unplacedForTask.isEmpty()) {
				throw new SchedulePostconditionException(
						SchedulePostconditionViolation.TASK_IDENTITY,
						"every ranked task must appear in the schedule result");
			}
		}
	}

	private static boolean hasWorkForTask(List<ScheduledBlock> blocks, long sourceTaskId) {
		for (ScheduledBlock block : blocks) {
			if (block.kind() == BlockKind.WORK && block.sourceTaskId() == sourceTaskId) {
				return true;
			}
		}
		return false;
	}
}
