package com.focusflow.testsupport;

import com.focusflow.plan.DailyPlan;
import com.focusflow.plan.DailyPlanRepository;
import com.focusflow.task.Task;
import com.focusflow.task.TaskRepository;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;

/** Shortcuts for persisting common test entities without cluttering tests. */
public final class PersistenceFixtures {

	private PersistenceFixtures() {}

	public static User savedUser(UserRepository userRepository, UserTestBuilder builder) {
		return userRepository.save(builder.build());
	}

	public static User savedUser(UserRepository userRepository) {
		return savedUser(userRepository, UserTestBuilder.user());
	}

	public static Task savedTask(TaskRepository taskRepository, TaskTestBuilder builder) {
		return taskRepository.save(builder.build());
	}

	public static DailyPlan savedPlan(DailyPlanRepository planRepository, DailyPlanTestBuilder builder) {
		DailyPlan plan = planRepository.save(builder.buildTasksOnly());
		planRepository.flush();
		builder.attachBlocksTo(plan);
		return planRepository.saveAndFlush(plan);
	}
}
