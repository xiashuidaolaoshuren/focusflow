package com.focusflow.plan;

import com.focusflow.task.Task;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;

final class PlanMustIncludeRules {

	private PlanMustIncludeRules() {}

	static boolean isMustInclude(Task task, LocalDate planDate) {
		if (task.getStatus() == TaskStatus.IN_PROGRESS) {
			return true;
		}
		if (task.getStatus() == TaskStatus.OPEN) {
			LocalDate dueDate = task.getDueDate();
			return dueDate != null && !dueDate.isAfter(planDate);
		}
		return false;
	}
}
