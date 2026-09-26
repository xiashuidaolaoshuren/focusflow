package com.focusflow.schedule;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class WorkPlacementPlanner {

	private WorkPlacementPlanner() {}

	public static PlacementResult place(
			FreeIntervalPlan stage1, List<RankedTask> ranking, PlacementPolicy policy) {
		List<ScheduledBlock> blocks = new ArrayList<>();
		List<UnplacedWork> unplacedWork = new ArrayList<>();
		PlacementCursor cursor = new PlacementCursor(stage1.freeIntervals());

		for (RankedTask task : ranking) {
			Integer estimate = task.estimatedMinutes();
			if (estimate == null) {
				unplacedWork.add(new UnplacedWork(task.sourceTaskId(), UnplacedReason.NO_ESTIMATE, null));
				continue;
			}
			if (estimate <= 0) {
				continue;
			}
			TaskPlacement placement =
					placeTaskCadenceOff(stage1.freeIntervals(), cursor, task, estimate);
			blocks.addAll(placement.blocks());
			if (placement.remainingMinutes() > 0) {
				unplacedWork.add(
						new UnplacedWork(
								task.sourceTaskId(),
								UnplacedReason.OUT_OF_TIME,
								placement.remainingMinutes()));
			}
		}

		blocks.addAll(copyUnavailableSegments(stage1.unavailableSegments()));
		blocks.sort(Comparator.comparing(ScheduledBlock::start));
		return new PlacementResult(blocks, unplacedWork);
	}

	private static TaskPlacement placeTaskCadenceOff(
			List<FreeInterval> intervals, PlacementCursor cursor, RankedTask task, int remaining) {
		List<ScheduledBlock> workBlocks = new ArrayList<>();
		while (remaining > 0 && cursor.hasRemaining(intervals)) {
			FreeInterval interval = intervals.get(cursor.intervalIndex());
			LocalTime intervalEnd = interval.end();
			int available = minutesBetween(cursor.position(), intervalEnd);
			if (available <= 0) {
				cursor.advanceToNextInterval(intervals);
				continue;
			}
			int placed = Math.min(remaining, available);
			LocalTime blockStart = cursor.position();
			LocalTime blockEnd = blockStart.plusMinutes(placed);
			workBlocks.add(
					new ScheduledBlock(
							BlockKind.WORK,
							blockStart,
							blockEnd,
							task.sourceTaskId(),
							null,
							workBlocks.size() + 1,
							0));
			cursor.moveTo(blockEnd, intervals);
			remaining -= placed;
		}
		int sessionCount = workBlocks.size();
		if (sessionCount == 0) {
			return new TaskPlacement(List.of(), remaining);
		}
		List<ScheduledBlock> numbered = new ArrayList<>();
		for (int i = 0; i < workBlocks.size(); i++) {
			ScheduledBlock block = workBlocks.get(i);
			numbered.add(
					new ScheduledBlock(
							block.kind(),
							block.start(),
							block.end(),
							block.sourceTaskId(),
							block.label(),
							i + 1,
							sessionCount));
		}
		return new TaskPlacement(numbered, remaining);
	}

	private record TaskPlacement(List<ScheduledBlock> blocks, int remainingMinutes) {}

	private static List<ScheduledBlock> copyUnavailableSegments(List<UnavailableSegment> segments) {
		List<ScheduledBlock> blocks = new ArrayList<>();
		for (UnavailableSegment segment : segments) {
			blocks.add(
					new ScheduledBlock(
							toBlockKind(segment.kind()),
							segment.start(),
							segment.end(),
							null,
							segment.label(),
							0,
							0));
		}
		return blocks;
	}

	private static BlockKind toBlockKind(UnavailableSegmentKind kind) {
		return switch (kind) {
			case FIXED_BREAK -> BlockKind.FIXED_BREAK;
			case COMMITMENT -> BlockKind.COMMITMENT;
			case BUFFER -> BlockKind.BUFFER;
		};
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}

	private static final class PlacementCursor {
		private int intervalIndex;
		private LocalTime position;

		private PlacementCursor(List<FreeInterval> intervals) {
			if (intervals.isEmpty()) {
				this.intervalIndex = 0;
				this.position = LocalTime.MIDNIGHT;
			} else {
				this.intervalIndex = 0;
				this.position = intervals.get(0).start();
			}
		}

		private int intervalIndex() {
			return intervalIndex;
		}

		private LocalTime position() {
			return position;
		}

		private boolean hasRemaining(List<FreeInterval> intervals) {
			return intervalIndex < intervals.size();
		}

		private void moveTo(LocalTime nextPosition, List<FreeInterval> intervals) {
			position = nextPosition;
			if (intervalIndex < intervals.size()
					&& !nextPosition.isBefore(intervals.get(intervalIndex).end())) {
				advanceToNextInterval(intervals);
			}
		}

		private void advanceToNextInterval(List<FreeInterval> intervals) {
			intervalIndex++;
			if (intervalIndex < intervals.size()) {
				position = intervals.get(intervalIndex).start();
			}
		}
	}
}
