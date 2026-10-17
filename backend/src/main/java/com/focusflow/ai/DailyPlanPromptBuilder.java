package com.focusflow.ai;

import com.focusflow.dependency.RankingGroup;
import org.springframework.stereotype.Component;

@Component
public class DailyPlanPromptBuilder {

	private static final int MAX_DESCRIPTION_LENGTH = 500;

	public String build(AiDailyPlanRequest request) {
		StringBuilder prompt = new StringBuilder();
		prompt.append("Plan date: ").append(request.planDate()).append('\n');
		for (AiPlanTask task : request.tasks()) {
			prompt.append(formatTaskLine(task)).append('\n');
		}
		prompt.append("Ranking rules:\n");
		prompt.append("- Prefer HIGH over MEDIUM over LOW priority.\n");
		prompt.append(
				"- When priority is equal, prefer the sooner due date. Use title and description only to break ties when both priority and due date are equal.\n");
		prompt.append(
				"- Use each task's labeled block= value instead of recomputing urgency from status or due date.\n");
		prompt.append(
				"- Return every listed task id exactly once, in block order: must-continue, then due-or-overdue, then optional.\n");
		prompt.append(
				"- Place each task after every id listed in its blockedBy= list (when present).\n");
		prompt.append(
				"- When priority and due date are equal, prefer tasks that have estimates.\n");
		prompt.append("Return an ordered daily plan using only the listed task ids.");
		return prompt.toString();
	}

	private String formatTaskLine(AiPlanTask task) {
		StringBuilder line =
				new StringBuilder("- Task ")
						.append(task.id())
						.append(": ")
						.append(task.title())
						.append(" (priority=")
						.append(task.priority());
		if (task.description() != null && !task.description().isBlank()) {
			line.append(", description=").append(truncateDescription(task.description()));
		}
		if (task.dueDate() != null) {
			line.append(", dueDate=").append(task.dueDate());
		}
		if (task.estimatedMinutes() != null) {
			line.append(", estimatedMinutes=").append(task.estimatedMinutes());
		}
		if (task.remainingEffortMinutes() != null) {
			line.append(", remainingEffortMinutes=").append(task.remainingEffortMinutes());
		}
		line.append(", status=").append(task.status());
		if (task.block() != null) {
			line.append(", block=").append(blockLabel(task.block()));
		}
		if (task.blockedBy() != null && !task.blockedBy().isEmpty()) {
			line.append(", blockedBy=").append(String.join(",", task.blockedBy().stream().map(String::valueOf).toList()));
		}
		line.append(')');
		return line.toString();
	}

	private static String blockLabel(RankingGroup block) {
		return switch (block) {
			case MUST_CONTINUE -> "must-continue";
			case DUE_OR_OVERDUE -> "due-or-overdue";
			case OPTIONAL -> "optional";
		};
	}

	private static String truncateDescription(String description) {
		if (description.length() <= MAX_DESCRIPTION_LENGTH) {
			return description;
		}
		return description.substring(0, MAX_DESCRIPTION_LENGTH);
	}
}
