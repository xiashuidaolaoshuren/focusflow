package com.focusflow.plan;

import com.focusflow.ai.AiProviderException;
import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.LocalDate;
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
			List<Task> candidates, LocalDate planDate, List<Long> orderedTaskIds) {
		Map<Long, Task> candidateById = new HashMap<>();
		Map<Long, Integer> blockOf = new HashMap<>();
		for (Task candidate : candidates) {
			long id = candidate.getId() != null ? candidate.getId() : 0L;
			candidateById.put(id, candidate);
			blockOf.put(id, classifyBlock(candidate, planDate));
		}

		Set<Long> seenTaskIds = new HashSet<>();
		int highestBlockSeen = 0;
		for (Long taskId : orderedTaskIds) {
			if (!candidateById.containsKey(taskId)) {
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

	private int classifyBlock(Task task, LocalDate planDate) {
		if (task.getStatus() == TaskStatus.IN_PROGRESS) {
			return 1;
		}
		if (task.getStatus() == TaskStatus.OPEN) {
			LocalDate dueDate = task.getDueDate();
			if (dueDate != null && !dueDate.isAfter(planDate)) {
				return 2;
			}
			return 3;
		}
		throw new IllegalArgumentException("unexpected task status: " + task.getStatus());
	}
}
