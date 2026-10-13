package com.focusflow.plan;

import com.focusflow.ai.AiProviderException;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanRankingValidator {

	private static final String REJECTION_COUNTER_NAME = "focusflow.ranking.rejections";

	private final MeterRegistry meterRegistry;

	public DailyPlanRankingValidator(MeterRegistry meterRegistry) {
		this.meterRegistry = meterRegistry;
	}

	public void validateOrder(
			List<InheritedAssignment> assignments, List<Long> orderedTaskIds) {
		Map<Long, Integer> blockOf = new HashMap<>();
		Set<Long> candidateIds = new HashSet<>();
		for (InheritedAssignment assignment : assignments) {
			candidateIds.add(assignment.taskId());
			blockOf.put(assignment.taskId(), blockRank(assignment.group()));
		}

		Set<Long> seenTaskIds = new HashSet<>();
		int highestBlockSeen = 0;
		for (Long taskId : orderedTaskIds) {
			if (!candidateIds.contains(taskId)) {
				reject(
						RankingRejectionReason.UNKNOWN_TASK,
						"invalid task id in AI response: " + taskId);
			}
			if (!seenTaskIds.add(taskId)) {
				reject(
						RankingRejectionReason.DUPLICATE_TASK,
						"duplicate task id in AI response: " + taskId);
			}
			int block = blockOf.get(taskId);
			if (block < highestBlockSeen) {
				reject(
						RankingRejectionReason.BLOCK_ORDER,
						"block order violated in AI response");
			}
			highestBlockSeen = Math.max(highestBlockSeen, block);
		}

		for (Map.Entry<Long, Integer> entry : blockOf.entrySet()) {
			if (entry.getValue() == 1 && !seenTaskIds.contains(entry.getKey())) {
				reject(
						RankingRejectionReason.MISSING_BLOCK_1,
						"missing must-continue task in AI response: " + entry.getKey());
			}
			if (entry.getValue() == 2 && !seenTaskIds.contains(entry.getKey())) {
				reject(
						RankingRejectionReason.MISSING_BLOCK_2,
						"missing due-or-overdue task in AI response: " + entry.getKey());
			}
			if (entry.getValue() == 3 && !seenTaskIds.contains(entry.getKey())) {
				reject(
						RankingRejectionReason.MISSING_OPTIONAL,
						"missing optional task in AI response: " + entry.getKey());
			}
		}
	}

	private void reject(RankingRejectionReason reason, String message) {
		Counter.builder(REJECTION_COUNTER_NAME)
				.tag("reason", reason.name())
				.register(meterRegistry)
				.increment();
		throw new AiProviderException(message, reason);
	}

	private static int blockRank(RankingGroup group) {
		return switch (group) {
			case MUST_CONTINUE -> 1;
			case DUE_OR_OVERDUE -> 2;
			case OPTIONAL -> 3;
		};
	}
}
