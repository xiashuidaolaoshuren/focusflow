package com.focusflow.dependency;

import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

public final class InheritedRanking {

	private InheritedRanking() {}

	public static List<InheritedAssignment> assign(
			List<RankingCandidate> candidates,
			List<DependencyLink> links,
			LocalDate planDate,
			Set<Long> forecastMustContinueIds) {
		Map<Long, RankingCandidate> candidateById = new HashMap<>();
		Set<Long> candidateIds = new HashSet<>();
		for (RankingCandidate candidate : candidates) {
			candidateById.put(candidate.taskId(), candidate);
			candidateIds.add(candidate.taskId());
		}

		List<InheritedAssignment> assignments = new ArrayList<>();
		for (RankingCandidate candidate : candidates) {
			Set<Long> chainTaskIds = collectBlockedCandidates(candidate.taskId(), links, candidateIds);
			RankingGroup inheritedGroup = RankingGroup.OPTIONAL;
			LocalDate earliestDue = null;
			for (long taskId : chainTaskIds) {
				RankingCandidate member = candidateById.get(taskId);
				RankingGroup own =
						ownGroup(member, planDate, forecastMustContinueIds);
				inheritedGroup = inheritedGroup.mostUrgent(own);
				earliestDue = earliestDueDate(earliestDue, member.dueDate());
			}
			long neededForTaskId = selectNeededFor(chainTaskIds, candidateById, planDate, forecastMustContinueIds, inheritedGroup);
			assignments.add(
					new InheritedAssignment(
							candidate.taskId(), inheritedGroup, earliestDue, neededForTaskId));
		}
		return assignments;
	}

	private static Set<Long> collectBlockedCandidates(
			long startTaskId, List<DependencyLink> links, Set<Long> candidateIds) {
		Set<Long> collected = new HashSet<>();
		Queue<Long> queue = new ArrayDeque<>();
		queue.add(startTaskId);
		while (!queue.isEmpty()) {
			long current = queue.remove();
			if (!collected.add(current)) {
				continue;
			}
			for (DependencyLink link : links) {
				if (!link.blockerPlannable() || link.blockerId() != current) {
					continue;
				}
				long blockedId = link.blockedId();
				if (candidateIds.contains(blockedId)) {
					queue.add(blockedId);
				}
			}
		}
		return collected;
	}

	private static RankingGroup ownGroup(
			RankingCandidate candidate, LocalDate planDate, Set<Long> forecastMustContinueIds) {
		if (forecastMustContinueIds.contains(candidate.taskId())
				|| candidate.status() == TaskStatus.IN_PROGRESS) {
			return RankingGroup.MUST_CONTINUE;
		}
		if (candidate.status() == TaskStatus.OPEN) {
			LocalDate dueDate = candidate.dueDate();
			if (dueDate != null && !dueDate.isAfter(planDate)) {
				return RankingGroup.DUE_OR_OVERDUE;
			}
			return RankingGroup.OPTIONAL;
		}
		throw new IllegalArgumentException("unexpected candidate status: " + candidate.status());
	}

	private static LocalDate earliestDueDate(LocalDate currentEarliest, LocalDate candidateDue) {
		if (candidateDue == null) {
			return currentEarliest;
		}
		if (currentEarliest == null || candidateDue.isBefore(currentEarliest)) {
			return candidateDue;
		}
		return currentEarliest;
	}

	private static long selectNeededFor(
			Set<Long> chainTaskIds,
			Map<Long, RankingCandidate> candidateById,
			LocalDate planDate,
			Set<Long> forecastMustContinueIds,
			RankingGroup inheritedGroup) {
		return chainTaskIds.stream()
				.filter(
						taskId ->
								ownGroup(
												candidateById.get(taskId),
												planDate,
												forecastMustContinueIds)
										== inheritedGroup)
				.min(
						Comparator.comparing(
										(Long taskId) -> candidateById.get(taskId).dueDate(),
										Comparator.nullsLast(Comparator.naturalOrder()))
								.thenComparingLong(taskId -> taskId))
				.orElseThrow();
	}
}
