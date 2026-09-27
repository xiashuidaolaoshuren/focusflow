package com.focusflow.ai;

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
				"- Return every listed task id exactly once, in block order: must-continue (in-progress), then due-or-overdue open tasks, then optional work.\n");
		prompt.append(
				"- Open tasks with dueDate on or before the plan date are due-or-overdue and must be included before optional work.\n");
		prompt.append(
				"- Prefer tasks that have estimates. Do not pile on unestimated optional tasks.\n");
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
		line.append(", status=").append(task.status());
		line.append(')');
		return line.toString();
	}

	private static String truncateDescription(String description) {
		if (description.length() <= MAX_DESCRIPTION_LENGTH) {
			return description;
		}
		return description.substring(0, MAX_DESCRIPTION_LENGTH);
	}
}
