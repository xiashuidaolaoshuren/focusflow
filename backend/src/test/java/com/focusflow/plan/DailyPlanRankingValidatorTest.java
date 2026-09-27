package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.focusflow.ai.AiPlanItem;
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

	@Test
	void validate_rejectsUnknownTaskId() {
		Task candidate = new Task();
		ReflectionTestUtils.setField(candidate, "id", 1L);
		candidate.setTitle("Task 1");
		candidate.setStatus(TaskStatus.OPEN);
		candidate.setPriority(TaskPriority.MEDIUM);

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(999L, 1));

		assertThatThrownBy(
						() -> validator.validate(List.of(candidate), planDate, 120, aiItems))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.UNKNOWN_TASK);

		assertRejectionCounted(RankingRejectionReason.UNKNOWN_TASK);
	}

	@Test
	void validate_rejectsMissingBlock1Candidate() {
		Task candidate = task(1L, TaskStatus.IN_PROGRESS, null, null);

		assertThatThrownBy(
						() ->
								validator.validate(
										List.of(candidate), LocalDate.of(2026, 6, 1), 120, List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_1);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_1);
	}

	@Test
	void validate_rejectsMissingBlock2Candidate() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task candidate = task(1L, TaskStatus.OPEN, planDate, null);

		assertThatThrownBy(
						() -> validator.validate(List.of(candidate), planDate, 120, List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_2);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_2);
	}

	@Test
	void validate_rejectsBlockOrderViolation() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task block1 = task(1L, TaskStatus.IN_PROGRESS, null, null);
		Task block2 = task(2L, TaskStatus.OPEN, planDate, null);
		Task block3 = task(3L, TaskStatus.OPEN, planDate.plusDays(1), null);
		List<AiPlanItem> aiItems =
				List.of(new AiPlanItem(3L, 1), new AiPlanItem(1L, 2), new AiPlanItem(2L, 3));

		assertThatThrownBy(
						() ->
								validator.validate(
										List.of(block1, block2, block3), planDate, 120, aiItems))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.BLOCK_ORDER);

		assertRejectionCounted(RankingRejectionReason.BLOCK_ORDER);
	}

	@Test
	void validate_rejectsOptionalOverflow() {
		LocalDate planDate = LocalDate.of(2026, 6, 1);
		Task block1 = task(1L, TaskStatus.IN_PROGRESS, null, 30);
		Task block2 = task(2L, TaskStatus.OPEN, planDate, 30);
		Task block3 = task(3L, TaskStatus.OPEN, planDate.plusDays(1), 20);
		List<AiPlanItem> aiItems =
				List.of(new AiPlanItem(1L, 1), new AiPlanItem(2L, 2), new AiPlanItem(3L, 3));

		assertThatThrownBy(
						() ->
								validator.validate(
										List.of(block1, block2, block3), planDate, 50, aiItems))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.OPTIONAL_OVERFLOW);

		assertRejectionCounted(RankingRejectionReason.OPTIONAL_OVERFLOW);
	}

	@Test
	void validate_acceptsIntraBlockSortMistake() {
		Task high = task(1L, TaskStatus.IN_PROGRESS, null, null);
		high.setPriority(TaskPriority.HIGH);
		Task low = task(2L, TaskStatus.IN_PROGRESS, null, null);
		low.setPriority(TaskPriority.LOW);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(2L, 1), new AiPlanItem(1L, 2));

		validator.validate(List.of(high, low), LocalDate.of(2026, 6, 1), 120, aiItems);
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
