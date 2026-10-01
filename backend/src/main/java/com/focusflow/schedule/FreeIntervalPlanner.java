package com.focusflow.schedule;

import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

public final class FreeIntervalPlanner {

	private static final String BUFFER_LABEL = "Buffer";

	private FreeIntervalPlanner() {}

	public static FreeIntervalPlan plan(
			WorkWindow window,
			List<FixedBreakWindow> fixedBreaks,
			List<CommitmentWindow> commitments,
			int bufferMinutes) {
		List<UnavailableSegment> segments =
				unavailableSegments(window, fixedBreaks, commitments);
		List<Span> freeSpans = freeSpans(window, segments);
		int realizedBufferMinutes =
				reserveTrailingBuffer(freeSpans, segments, bufferMinutes);
		segments.sort(Comparator.comparing(UnavailableSegment::start));
		List<FreeInterval> freeIntervals = withRestorativeFlags(window, freeSpans, segments);
		return new FreeIntervalPlan(
				freeIntervals, segments, totalFreeMinutes(freeIntervals), bufferMinutes, realizedBufferMinutes);
	}

	private static List<UnavailableSegment> unavailableSegments(
			WorkWindow window, List<FixedBreakWindow> fixedBreaks, List<CommitmentWindow> commitments) {
		List<UnavailableSegment> segments = new ArrayList<>();
		List<Span> commitmentSpans = new ArrayList<>();
		for (CommitmentWindow commitment : commitments) {
			clip(window, commitment.start(), commitment.end())
					.ifPresent(span -> {
						commitmentSpans.add(span);
						segments.add(
								new UnavailableSegment(
										UnavailableSegmentKind.COMMITMENT,
										commitment.title(),
										span.start(),
										span.end()));
					});
		}
		List<Span> normalizedCommitmentSpans = normalizeCommitmentSpans(commitmentSpans);
		for (FixedBreakWindow fixedBreak : fixedBreaks) {
			clip(window, fixedBreak.start(), fixedBreak.end())
					.ifPresent(
							span ->
									addFixedBreakPortions(
											segments, fixedBreak, normalizedCommitmentSpans, span));
		}
		segments.sort(Comparator.comparing(UnavailableSegment::start));
		return segments;
	}

	private static void addFixedBreakPortions(
			List<UnavailableSegment> segments,
			FixedBreakWindow fixedBreak,
			List<Span> commitmentSpans,
			Span breakSpan) {
		LocalTime cursor = breakSpan.start();
		for (Span commitment : commitmentSpans) {
			LocalTime overlapStart = later(cursor, commitment.start());
			LocalTime overlapEnd = earlier(breakSpan.end(), commitment.end());
			if (overlapStart.isBefore(overlapEnd)) {
				if (cursor.isBefore(overlapStart)) {
					segments.add(fixedBreakSegment(fixedBreak, cursor, overlapStart));
				}
				cursor = later(cursor, commitment.end());
			}
		}
		if (cursor.isBefore(breakSpan.end())) {
			segments.add(fixedBreakSegment(fixedBreak, cursor, breakSpan.end()));
		}
	}

	private static List<Span> normalizeCommitmentSpans(List<Span> commitmentSpans) {
		if (commitmentSpans.isEmpty()) {
			return List.of();
		}
		List<Span> sorted =
				commitmentSpans.stream()
						.sorted(Comparator.comparing(Span::start))
						.toList();
		List<Span> merged = new ArrayList<>();
		Span current = sorted.get(0);
		for (int index = 1; index < sorted.size(); index++) {
			Span next = sorted.get(index);
			if (!next.start().isAfter(current.end())) {
				current = new Span(current.start(), later(current.end(), next.end()));
			} else {
				merged.add(current);
				current = next;
			}
		}
		merged.add(current);
		return merged;
	}

	private static UnavailableSegment fixedBreakSegment(FixedBreakWindow fixedBreak, LocalTime start, LocalTime end) {
		return new UnavailableSegment(
				UnavailableSegmentKind.FIXED_BREAK, fixedBreak.label(), start, end);
	}

	private static List<Span> freeSpans(WorkWindow window, List<UnavailableSegment> segments) {
		List<Span> spans = new ArrayList<>();
		LocalTime cursor = window.start();
		for (UnavailableSegment segment : segments) {
			if (segment.start().isAfter(cursor)) {
				spans.add(new Span(cursor, segment.start()));
			}
			if (segment.end().isAfter(cursor)) {
				cursor = segment.end();
			}
		}
		if (cursor.isBefore(window.end())) {
			spans.add(new Span(cursor, window.end()));
		}
		return spans;
	}

	private static int reserveTrailingBuffer(
			List<Span> freeSpans, List<UnavailableSegment> segments, int requestedMinutes) {
		int remaining = requestedMinutes;
		for (int i = freeSpans.size() - 1; i >= 0 && remaining > 0; i--) {
			Span span = freeSpans.get(i);
			int reserved = Math.min(minutesBetween(span.start(), span.end()), remaining);
			LocalTime reserveStart = span.end().minusMinutes(reserved);
			segments.add(
					new UnavailableSegment(
							UnavailableSegmentKind.BUFFER, BUFFER_LABEL, reserveStart, span.end()));
			if (reserveStart.isAfter(span.start())) {
				freeSpans.set(i, new Span(span.start(), reserveStart));
			} else {
				freeSpans.remove(i);
			}
			remaining -= reserved;
		}
		return requestedMinutes - remaining;
	}

	private static List<FreeInterval> withRestorativeFlags(
			WorkWindow window, List<Span> spans, List<UnavailableSegment> segments) {
		List<FreeInterval> intervals = new ArrayList<>();
		for (int i = 0; i < spans.size(); i++) {
			Span span = spans.get(i);
			LocalTime gapBeforeStart = i == 0 ? window.start() : spans.get(i - 1).end();
			LocalTime gapAfterEnd = i == spans.size() - 1 ? window.end() : spans.get(i + 1).start();
			intervals.add(
					new FreeInterval(
							span.start(),
							span.end(),
							gapContainsFixedBreak(segments, gapBeforeStart, span.start()),
							gapContainsFixedBreak(segments, span.end(), gapAfterEnd)));
		}
		return intervals;
	}

	private static boolean gapContainsFixedBreak(List<UnavailableSegment> segments, LocalTime start, LocalTime end) {
		return segments.stream()
				.anyMatch(
						segment ->
								segment.kind() == UnavailableSegmentKind.FIXED_BREAK
										&& !segment.start().isBefore(start)
										&& !segment.end().isAfter(end));
	}

	private static Optional<Span> clip(WorkWindow window, LocalTime start, LocalTime end) {
		LocalTime clippedStart = start.isBefore(window.start()) ? window.start() : start;
		LocalTime clippedEnd = end.isAfter(window.end()) ? window.end() : end;
		if (!clippedEnd.isAfter(clippedStart)) {
			return Optional.empty();
		}
		return Optional.of(new Span(clippedStart, clippedEnd));
	}

	private static LocalTime later(LocalTime a, LocalTime b) {
		return a.isAfter(b) ? a : b;
	}

	private static LocalTime earlier(LocalTime a, LocalTime b) {
		return a.isBefore(b) ? a : b;
	}

	private static int totalFreeMinutes(List<FreeInterval> intervals) {
		return intervals.stream()
				.mapToInt(interval -> minutesBetween(interval.start(), interval.end()))
				.sum();
	}

	private static int minutesBetween(LocalTime start, LocalTime end) {
		return (int) Duration.between(start, end).toMinutes();
	}

	private record Span(LocalTime start, LocalTime end) {}
}