package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.focusflow.ai.AiProviderException;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class DailyPlanRankingValidatorTest {

	private final SimpleMeterRegistry meterRegistry = new SimpleMeterRegistry();
	private final DailyPlanRankingValidator validator =
			new DailyPlanRankingValidator(meterRegistry);

	@Test
	void validator_isConstructible() {
		DailyPlanRankingValidator validator = new DailyPlanRankingValidator(meterRegistry);
		assertNotNull(validator);
	}

	@Test
	void validateOrder_rejectsUnknownTaskId() {
		Task candidate = task(1L, TaskStatus.OPEN, null, null);
		LocalDate planDate = LocalDate.of(2026, 6, 1);

		assertThatThrownBy(
						() ->
								validator.validateOrder(
										List.of(candidate), planDate, List.of(999L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.UNKNOWN_TASK);

		assertRejectionCounted(RankingRejectionReason.UNKNOWN_TASK);
	}

	@Test
	void validateOrder_rejectsDuplicateTaskId() {
		Task candidate = task(1L, TaskStatus.OPEN, null, null);
		LocalDate planDate = LocalDate.of(2026, 6, 1);

		assertThatThrownBy(
						() ->
								validator.validateOrder(
										List.of(candidate), planDate, List.of(1L, 1L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.DUPLICATE_TASK);

		assertRejectionCounted(RankingRejectionReason.DUPLICATE_TASK);
	}

	@Test
	void validateOrder_rejectsMissingBlock1Candidate() {
		Task candidate = task(1L, TaskStatus.IN_PROGRESS, null, null);

		assertThatThrownBy(
						() ->
								validator.validateOrder(
										List.of(candidate), LocalDate.of(2026, 6, 1), List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_1);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_1);
	}

	@Test
	void validateOrder_rejectsMissingBlock2Candidate() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task candidate = task(1L, TaskStatus.OPEN, planDate, null);

		assertThatThrownBy(
						() -> validator.validateOrder(List.of(candidate), planDate, List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_2);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_2);
	}

	@Test
	void validateOrder_rejectsMissingOptionalCandidate() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task candidate = task(1L, TaskStatus.OPEN, planDate.plusDays(1), null);

		assertThatThrownBy(
						() -> validator.validateOrder(List.of(candidate), planDate, List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_OPTIONAL);

		assertRejectionCounted(RankingRejectionReason.MISSING_OPTIONAL);
	}

	@Test
	void validateOrder_rejectsBlockOrderViolation() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task block1 = task(1L, TaskStatus.IN_PROGRESS, null, null);
		Task block2 = task(2L, TaskStatus.OPEN, planDate, null);
		Task block3 = task(3L, TaskStatus.OPEN, planDate.plusDays(1), null);

		assertThatThrownBy(
						() ->
								validator.validateOrder(
										List.of(block1, block2, block3),
										planDate,
										List.of(3L, 1L, 2L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.BLOCK_ORDER);

		assertRejectionCounted(RankingRejectionReason.BLOCK_ORDER);
	}

	@Test
	void validateOrder_acceptsIntraBlockSortMistake() {
		Task high = task(1L, TaskStatus.IN_PROGRESS, null, null);
		high.setPriority(TaskPriority.HIGH);
		Task low = task(2L, TaskStatus.IN_PROGRESS, null, null);
		low.setPriority(TaskPriority.LOW);

		validator.validateOrder(
				List.of(high, low), LocalDate.of(2026, 6, 1), List.of(2L, 1L));
	}

	private void assertRejectionCounted(RankingRejectionReason reason) {
		Counter counter =
				meterRegistry
						.find("focusflow.ranking.rejections")
						.tag("reason", reason.name())
						.counter();
		assertThat(counter).isNotNull();
		assertThat(counter.count()).isEqualTo(1.0);
	}

	private Task task(Long id, TaskStatus status, LocalDate dueDate, Integer estimatedMinutes) {
		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", id);
		task.setTitle("Task " + id);
		task.setStatus(status);
		task.setPriority(TaskPriority.MEDIUM);
		task.setDueDate(dueDate);
		task.setEstimatedMinutes(estimatedMinutes);
		return task;
	}
}
