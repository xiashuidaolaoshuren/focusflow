package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.focusflow.ai.AiProviderException;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

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
		InheritedAssignment candidate = assignment(1L, RankingGroup.OPTIONAL);

		assertThatThrownBy(
						() -> validator.validateOrder(List.of(candidate), List.of(999L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.UNKNOWN_TASK);

		assertRejectionCounted(RankingRejectionReason.UNKNOWN_TASK);
	}

	@Test
	void validateOrder_rejectsDuplicateTaskId() {
		InheritedAssignment candidate = assignment(1L, RankingGroup.OPTIONAL);

		assertThatThrownBy(
						() -> validator.validateOrder(List.of(candidate), List.of(1L, 1L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.DUPLICATE_TASK);

		assertRejectionCounted(RankingRejectionReason.DUPLICATE_TASK);
	}

	@Test
	void validateOrder_rejectsMissingBlock1Candidate() {
		InheritedAssignment candidate = assignment(1L, RankingGroup.MUST_CONTINUE);

		assertThatThrownBy(() -> validator.validateOrder(List.of(candidate), List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_1);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_1);
	}

	@Test
	void validateOrder_rejectsMissingBlock2Candidate() {
		InheritedAssignment candidate = assignment(1L, RankingGroup.DUE_OR_OVERDUE);

		assertThatThrownBy(() -> validator.validateOrder(List.of(candidate), List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_2);

		assertRejectionCounted(RankingRejectionReason.MISSING_BLOCK_2);
	}

	@Test
	void validateOrder_rejectsMissingOptionalCandidate() {
		InheritedAssignment candidate = assignment(1L, RankingGroup.OPTIONAL);

		assertThatThrownBy(() -> validator.validateOrder(List.of(candidate), List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_OPTIONAL);

		assertRejectionCounted(RankingRejectionReason.MISSING_OPTIONAL);
	}

	@Test
	void validateOrder_rejectsBlockOrderViolation() {
		InheritedAssignment block1 = assignment(1L, RankingGroup.MUST_CONTINUE);
		InheritedAssignment block2 = assignment(2L, RankingGroup.DUE_OR_OVERDUE);
		InheritedAssignment block3 = assignment(3L, RankingGroup.OPTIONAL);

		assertThatThrownBy(
						() ->
								validator.validateOrder(
										List.of(block1, block2, block3), List.of(3L, 1L, 2L)))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.BLOCK_ORDER);

		assertRejectionCounted(RankingRejectionReason.BLOCK_ORDER);
	}

	@Test
	void validateOrder_acceptsIntraBlockSortMistake() {
		InheritedAssignment high = assignment(1L, RankingGroup.MUST_CONTINUE);
		InheritedAssignment low = assignment(2L, RankingGroup.MUST_CONTINUE);

		validator.validateOrder(List.of(high, low), List.of(2L, 1L));
	}

	@Test
	void validateOrder_acceptsSameGroupDependencyInversion() {
		InheritedAssignment blocker = assignment(1L, RankingGroup.DUE_OR_OVERDUE);
		InheritedAssignment blocked = assignment(2L, RankingGroup.DUE_OR_OVERDUE);

		validator.validateOrder(List.of(blocker, blocked), List.of(2L, 1L));
	}

	@Test
	void validateOrder_rejectsMissingInheritedDueOrOverdue() {
		InheritedAssignment inheritedUrgent = assignment(1L, RankingGroup.DUE_OR_OVERDUE);

		assertThatThrownBy(() -> validator.validateOrder(List.of(inheritedUrgent), List.of()))
				.isInstanceOf(AiProviderException.class)
				.extracting(ex -> ((AiProviderException) ex).getReason())
				.isEqualTo(RankingRejectionReason.MISSING_BLOCK_2);
	}

	private static InheritedAssignment assignment(long taskId, RankingGroup group) {
		return new InheritedAssignment(taskId, group, LocalDate.of(2026, 6, 1), taskId);
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
}
