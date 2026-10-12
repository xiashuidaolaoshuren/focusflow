package com.focusflow.schedule;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public record ComposedDay(
		List<RailSegment> rail,
		List<RevisionBlock> offRailEarlyCompletions,
		DayActuals actuals) {

	public static ComposedDay compose(
			LocalTime windowStart, List<RevisionView> revisionsOldestFirst) {
		if (revisionsOldestFirst.isEmpty()) {
			return new ComposedDay(List.of(), List.of(), new DayActuals(0, 0));
		}
		if (revisionsOldestFirst.size() == 1) {
			RevisionView revision = revisionsOldestFirst.getFirst();
			List<RailSegment> rail = toRailSegments(revision.revisionNumber(), revision.blocks());
			return new ComposedDay(
					rail, List.of(), computeDayActuals(windowStart, revisionsOldestFirst));
		}

		List<RailSegment> rail = new ArrayList<>();
		List<RevisionBlock> offRail = new ArrayList<>();

		for (int index = 0; index < revisionsOldestFirst.size(); index++) {
			RevisionView revision = revisionsOldestFirst.get(index);
			if (index == revisionsOldestFirst.size() - 1) {
				LocalTime cutoff = effectiveCutoff(revision, windowStart);
				addLatestRevisionBlocks(rail, revision, cutoff);
			} else {
				LocalTime boundary =
						effectiveCutoff(revisionsOldestFirst.get(index + 1), windowStart);
				addOlderRevisionBlocks(rail, offRail, revision, boundary);
			}
		}

		List<RailSegment> sortedRail = sortAndNumberSessions(rail);
		return new ComposedDay(
				sortedRail, offRail, computeDayActuals(windowStart, revisionsOldestFirst));
	}

	static DayActuals computeDayActuals(
			LocalTime windowStart, List<RevisionView> revisionsOldestFirst) {
		int knownActualMinutes = 0;
		int missingActualCount = 0;

		for (int index = 0; index < revisionsOldestFirst.size(); index++) {
			RevisionView revision = revisionsOldestFirst.get(index);
			LocalTime supersededBoundary =
					index < revisionsOldestFirst.size() - 1
							? effectiveCutoff(revisionsOldestFirst.get(index + 1), windowStart)
							: null;

			for (RevisionBlock block : revision.blocks()) {
				if (block.kind() != BlockKind.WORK) {
					continue;
				}
				if (supersededBoundary != null
						&& !block.start().isBefore(supersededBoundary)
						&& block.outcome() == null) {
					continue;
				}
				if (block.actualMinutes() != null) {
					knownActualMinutes += block.actualMinutes();
					continue;
				}
				if (block.outcome() == WorkOutcome.DONE) {
					missingActualCount++;
				}
			}
		}

		return new DayActuals(knownActualMinutes, missingActualCount);
	}

	private static LocalTime effectiveCutoff(RevisionView revision, LocalTime windowStart) {
		return revision.cutoff() != null ? revision.cutoff() : windowStart;
	}

	private static void addOlderRevisionBlocks(
			List<RailSegment> rail,
			List<RevisionBlock> offRail,
			RevisionView revision,
			LocalTime boundary) {
		for (RevisionBlock block : revision.blocks()) {
			if (!block.end().isAfter(boundary)) {
				rail.add(toRailSegment(revision.revisionNumber(), block, block.start(), block.end()));
				continue;
			}
			if (!block.start().isBefore(boundary)) {
				if (block.outcome() != null) {
					offRail.add(block);
				}
				continue;
			}
			if (block.kind() == BlockKind.WORK && !block.reconciled()) {
				continue;
			}
			rail.add(toRailSegment(revision.revisionNumber(), block, block.start(), boundary));
		}
	}

	private static void addLatestRevisionBlocks(
			List<RailSegment> rail, RevisionView revision, LocalTime cutoff) {
		for (RevisionBlock block : revision.blocks()) {
			if (!block.start().isBefore(cutoff)) {
				rail.add(
						toRailSegment(
								revision.revisionNumber(),
								block,
								block.start(),
								block.end()));
			}
		}
	}

	private static List<RailSegment> sortAndNumberSessions(List<RailSegment> rail) {
		List<RailSegment> sorted =
				rail.stream()
						.sorted(Comparator.comparing(RailSegment::start))
						.toList();
		Map<Long, Integer> sessionCounts = new HashMap<>();
		for (RailSegment segment : sorted) {
			if (segment.kind() == BlockKind.WORK && segment.sourceTaskId() != null) {
				sessionCounts.merge(segment.sourceTaskId(), 1, Integer::sum);
			}
		}
		Map<Long, Integer> sessionProgress = new HashMap<>();
		List<RailSegment> numbered = new ArrayList<>();
		for (RailSegment segment : sorted) {
			if (segment.kind() == BlockKind.WORK && segment.sourceTaskId() != null) {
				Long taskId = segment.sourceTaskId();
				int sessionIndex = sessionProgress.merge(taskId, 1, Integer::sum);
				int sessionCount = sessionCounts.getOrDefault(taskId, 0);
				numbered.add(
						new RailSegment(
								segment.revisionNumber(),
								segment.kind(),
								segment.start(),
								segment.end(),
								taskId,
								segment.label(),
								segment.outcome(),
								segment.actualMinutes(),
								sessionIndex,
								sessionCount));
			} else {
				numbered.add(segment);
			}
		}
		return numbered;
	}

	private static List<RailSegment> toRailSegments(int revisionNumber, List<RevisionBlock> blocks) {
		List<RailSegment> rail = new ArrayList<>();
		for (RevisionBlock block : blocks) {
			rail.add(toRailSegment(revisionNumber, block, block.start(), block.end()));
		}
		return sortAndNumberSessions(rail);
	}

	private static RailSegment toRailSegment(
			int revisionNumber, RevisionBlock block, LocalTime start, LocalTime end) {
		return new RailSegment(
				revisionNumber,
				block.kind(),
				start,
				end,
				block.sourceTaskId(),
				block.label(),
				block.outcome(),
				block.actualMinutes(),
				null,
				null);
	}
}
