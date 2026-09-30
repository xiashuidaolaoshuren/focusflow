package com.focusflow.schedule;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class WorkPlacementPlanner {

	private static final String CADENCE_BREAK_LABEL = "Cadence break";

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
					policy.cadenceEnabled()
							? placeTaskCadenceOn(stage1.freeIntervals(), cursor, task, estimate, policy)
							: placeTaskCadenceOff(stage1.freeIntervals(), cursor, task, estimate, policy);
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

	private static TaskPlacement placeTaskCadenceOn(
			List<FreeInterval> intervals,
			PlacementCursor cursor,
			RankedTask task,
			int remaining,
			PlacementPolicy policy) {
		List<ScheduledBlock> placed = new ArrayList<>();
		while (remaining > 0 && cursor.hasRemaining(intervals)) {
			FreeInterval interval = intervals.get(cursor.intervalIndex());
			int available = minutesBetween(cursor.position(), interval.end());
			if (available <= 0) {
				cursor.advanceToNextInterval(intervals);
				continue;
			}
			int budget = Math.max(policy.targetFocusMinutes() - cursor.focusClock(), 0);
			if (budget < policy.minSessionMinutes()) {
				if (available >= policy.breakMinutes()) {
					LocalTime breakStart = cursor.position();
					LocalTime breakEnd = breakStart.plusMinutes(policy.breakMinutes());
					placed.add(
							new ScheduledBlock(
									BlockKind.CADENCE_BREAK,
									breakStart,
									breakEnd,
									null,
									CADENCE_BREAK_LABEL,
									0,
									0));
					cursor.moveTo(breakEnd, intervals);
					cursor.resetFocus();
				} else {
					cursor.advanceToNextInterval(intervals);
				}
				continue;
			}
			int capped = Math.min(remaining, Math.min(available, budget));
			int sessionLength = capped;
			if (remaining > capped
					&& remaining - capped < policy.minSessionMinutes()
					&& remaining <= available) {
				sessionLength = remaining;
			}
			if (sessionLength < policy.minSessionMinutes() && remaining > sessionLength) {
				cursor.advanceToNextInterval(intervals);
				continue;
			}
			if (sessionLength <= 0) {
				cursor.advanceToNextInterval(intervals);
				continue;
			}
			int indexBefore = cursor.intervalIndex();
			LocalTime blockStart = cursor.position();
			LocalTime blockEnd = blockStart.plusMinutes(sessionLength);
			placed.add(
					new ScheduledBlock(
							BlockKind.WORK,
							blockStart,
							blockEnd,
							task.sourceTaskId(),
							null,
							0,
							0));
			cursor.addFocus(sessionLength);
			cursor.moveTo(blockEnd, intervals);
			remaining -= sessionLength;

			if (cursor.intervalIndex() != indexBefore) {
				continue;
			}

			if (remaining > 0 && cursor.hasRemaining(intervals)) {
				FreeInterval current = intervals.get(cursor.intervalIndex());
				int room = minutesBetween(cursor.position(), current.end());
				if (room >= policy.breakMinutes()) {
					LocalTime breakStart = cursor.position();
					LocalTime breakEnd = breakStart.plusMinutes(policy.breakMinutes());
					placed.add(
							new ScheduledBlock(
									BlockKind.CADENCE_BREAK,
									breakStart,
									breakEnd,
									null,
									CADENCE_BREAK_LABEL,
									0,
									0));
					cursor.moveTo(breakEnd, intervals);
					cursor.resetFocus();
				} else {
					cursor.advanceToNextInterval(intervals);
				}
			}
		}
		return new TaskPlacement(numberSessions(placed), remaining);
	}

	private static TaskPlacement placeTaskCadenceOff(
			List<FreeInterval> intervals,
			PlacementCursor cursor,
			RankedTask task,
			int remaining,
			PlacementPolicy policy) {
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
			if (placed < policy.minSessionMinutes() && remaining > placed) {
				cursor.advanceToNextInterval(intervals);
				continue;
			}
			LocalTime blockStart = cursor.position();
			LocalTime blockEnd = blockStart.plusMinutes(placed);
			workBlocks.add(
					new ScheduledBlock(
							BlockKind.WORK,
							blockStart,
							blockEnd,
							task.sourceTaskId(),
							null,
							0,
							0));
			cursor.moveTo(blockEnd, intervals);
			remaining -= placed;
		}
		return new TaskPlacement(numberSessions(workBlocks), remaining);
	}

	private static List<ScheduledBlock> numberSessions(List<ScheduledBlock> placed) {
		int sessionCount = 0;
		for (ScheduledBlock block : placed) {
			if (block.kind() == BlockKind.WORK) {
				sessionCount++;
			}
		}
		List<ScheduledBlock> numbered = new ArrayList<>();
		int sessionIndex = 0;
		for (ScheduledBlock block : placed) {
			if (block.kind() == BlockKind.WORK) {
				sessionIndex++;
				numbered.add(
						new ScheduledBlock(
								block.kind(),
								block.start(),
								block.end(),
								block.sourceTaskId(),
								block.label(),
								sessionIndex,
								sessionCount));
			} else {
				numbered.add(block);
			}
		}
		return numbered;
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
		private int focusClock;

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

		private int focusClock() {
			return focusClock;
		}

		private void addFocus(int minutes) {
			focusClock += minutes;
		}

		private void resetFocus() {
			focusClock = 0;
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
			if (intervalIndex < intervals.size()
					&& intervals.get(intervalIndex).restorativeAfterEnd()) {
				focusClock = 0;
			}
			intervalIndex++;
			if (intervalIndex < intervals.size()) {
				position = intervals.get(intervalIndex).start();
			}
		}
	}
}
