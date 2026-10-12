package com.focusflow.dependency;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class DependencyOrderRepair {

	private DependencyOrderRepair() {}

	public static List<Long> repair(
			List<Long> orderedIds, List<DependencyLink> links, Map<Long, RankingGroup> groups) {
		Map<Long, Integer> originalIndex = new HashMap<>();
		for (int index = 0; index < orderedIds.size(); index++) {
			originalIndex.put(orderedIds.get(index), index);
		}
		Set<Long> rankingIds = new HashSet<>(orderedIds);
		Set<Long> emitted = new HashSet<>();
		Set<Long> remaining = new HashSet<>(orderedIds);
		List<Long> repaired = new ArrayList<>();

		while (!remaining.isEmpty()) {
			List<Long> legal = new ArrayList<>();
			for (long taskId : remaining) {
				if (activeBlockers(taskId, links, rankingIds).stream().allMatch(emitted::contains)) {
					legal.add(taskId);
				}
			}
			if (legal.isEmpty()) {
				throw new BrokenDependencyOrderException(
						"no legal task to emit while repairing dependency order");
			}
			long next =
					legal.stream()
							.min(Comparator.comparingInt(taskId -> originalIndex.get(taskId)))
							.orElseThrow();
			RankingGroup nextGroup = groups.get(next);
			for (long taskId : remaining) {
				RankingGroup group = groups.get(taskId);
				if (group != null && group.isMoreUrgentThan(nextGroup)) {
					throw new BrokenDependencyOrderException(
							"repair would emit a less urgent task before a more urgent one");
				}
			}
			emitted.add(next);
			remaining.remove(next);
			repaired.add(next);
		}
		return repaired;
	}

	private static List<Long> activeBlockers(
			long taskId, List<DependencyLink> links, Set<Long> rankingIds) {
		List<Long> blockers = new ArrayList<>();
		for (DependencyLink link : links) {
			if (link.blockerPlannable()
					&& link.blockedId() == taskId
					&& rankingIds.contains(link.blockerId())) {
				blockers.add(link.blockerId());
			}
		}
		return blockers;
	}
}
