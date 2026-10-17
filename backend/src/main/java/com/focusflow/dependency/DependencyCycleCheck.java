package com.focusflow.dependency;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

public final class DependencyCycleCheck {

	private DependencyCycleCheck() {}

	public static boolean wouldCycle(
			List<DependencyLink> existingLinks, long blockerId, long blockedId) {
		if (blockerId == blockedId) {
			return true;
		}
		for (DependencyLink link : existingLinks) {
			if (link.blockerId() == blockerId && link.blockedId() == blockedId) {
				return false;
			}
		}
		Map<Long, List<Long>> blocks = new HashMap<>();
		for (DependencyLink link : existingLinks) {
			blocks.computeIfAbsent(link.blockerId(), ignored -> new ArrayList<>())
					.add(link.blockedId());
		}
		Set<Long> visited = new HashSet<>();
		Queue<Long> queue = new ArrayDeque<>();
		queue.add(blockedId);
		while (!queue.isEmpty()) {
			long current = queue.remove();
			if (current == blockerId) {
				return true;
			}
			if (!visited.add(current)) {
				continue;
			}
			for (Long next : blocks.getOrDefault(current, List.of())) {
				queue.add(next);
			}
		}
		return false;
	}
}
