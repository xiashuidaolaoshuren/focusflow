package com.focusflow.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class DailyPlanPromptBuilderTest {

	private final DailyPlanPromptBuilder promptBuilder = new DailyPlanPromptBuilder();

	@Test
	void aiPlanTask_exposesStatus() {
		AiPlanTask task =
				new AiPlanTask(1L, "t", null, TaskPriority.HIGH, null, null, TaskStatus.IN_PROGRESS);

		assertThat(task.status()).isEqualTo(TaskStatus.IN_PROGRESS);
	}

	@Test
	void build_includesStatusOnTaskLine() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										3L,
										"In progress task",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.IN_PROGRESS)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("status=IN_PROGRESS");
	}

	@Test
	void build_includesTaskCoreFieldsWithoutAvailableMinutes() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										"TDD coverage",
										TaskPriority.HIGH,
										LocalDate.of(2026, 6, 1),
										45,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("Write tests");
		assertThat(prompt).contains("HIGH");
		assertThat(prompt).doesNotContain("Available focus minutes");
		assertThat(prompt).doesNotContain("leftover");
	}

	@Test
	void build_omitsNullOptionalFieldsWithoutNullNoise() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										2L, "Minimal task", null, TaskPriority.MEDIUM, null, null, TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).doesNotContain("null");
		assertThat(prompt).contains("Minimal task");
		assertThat(prompt).contains("MEDIUM");
	}

	@Test
	void build_includesOptionalFieldsWhenPresent() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										"TDD coverage",
										TaskPriority.HIGH,
										LocalDate.of(2026, 6, 1),
										45,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("TDD coverage");
		assertThat(prompt).contains("2026-06-01");
		assertThat(prompt).contains("45");
	}

	@Test
	void build_preservesTaskOrderAndIncludesTaskIds() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										10L,
										"First task",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN),
								new AiPlanTask(
										20L,
										"Second task",
										null,
										TaskPriority.LOW,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("Task 10");
		assertThat(prompt).contains("Task 20");
		assertThat(prompt.indexOf("First task")).isLessThan(prompt.indexOf("Second task"));
	}

	@Test
	void build_includesPlanDateAndDueOrOverdueRule() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										null,
										TaskPriority.HIGH,
										LocalDate.of(2026, 6, 1),
										45,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("Plan date: 2026-06-01");
		assertThat(prompt)
				.contains(
						"Open tasks with dueDate on or before the plan date are due-or-overdue and must be included before optional work.");
	}

	@Test
	void build_includesRankingRules() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L,
										"Write tests",
										null,
										TaskPriority.HIGH,
										null,
										null,
										TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).contains("Prefer HIGH over MEDIUM over LOW");
		assertThat(prompt).contains("must-continue");
		assertThat(prompt).contains("due-or-overdue");
		assertThat(prompt).contains("every");
		assertThat(prompt).contains("exactly once");
		assertThat(prompt).contains("block order");
		assertThat(prompt).doesNotContain("Available focus minutes");
		assertThat(prompt).doesNotContain("leftover");
		assertThat(prompt).doesNotContain("optional work must fit");
	}

	@Test
	void build_prefersEstimatedTasksOnlyAsTieBreak() {
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(
						List.of(
								new AiPlanTask(
										1L, "Estimated", null, TaskPriority.MEDIUM, null, 45, TaskStatus.OPEN),
								new AiPlanTask(
										2L, "Unestimated", null, TaskPriority.MEDIUM, null, null, TaskStatus.OPEN)),
						LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(prompt).doesNotContain("Do not pile on unestimated optional tasks");
		assertThat(prompt)
				.contains("When priority and due date are equal, prefer tasks that have estimates.");
	}

	@Test
	void build_truncatesLongDescriptionsToFiveHundredCharacters() {
		String description = "x".repeat(500) + "Z";
		AiPlanTask task =
				new AiPlanTask(
						1L,
						"Write tests",
						description,
						TaskPriority.HIGH,
						null,
						null,
						TaskStatus.OPEN);
		AiDailyPlanRequest request =
				new AiDailyPlanRequest(List.of(task), LocalDate.of(2026, 6, 1));

		String prompt = promptBuilder.build(request);

		assertThat(task.description()).hasSize(501);
		assertThat(prompt).contains("x".repeat(500));
		assertThat(prompt).doesNotContain("Z");
	}
}
