package com.focusflow.dependency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class DependencyOrderRepairTest {

	@Test
	void repair_emitsEarliestLegalIndexWithinGroup() {
		List<Long> ordered = List.of(2L, 3L, 1L);
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));
		Map<Long, RankingGroup> groups =
				Map.of(1L, RankingGroup.DUE_OR_OVERDUE, 2L, RankingGroup.DUE_OR_OVERDUE, 3L, RankingGroup.DUE_OR_OVERDUE);

		List<Long> repaired = DependencyOrderRepair.repair(ordered, links, groups);

		assertThat(repaired).containsExactly(3L, 1L, 2L);
	}

	@Test
	void repair_throwsWhenLaterGroupWouldMoveAhead() {
		List<Long> ordered = List.of(2L, 1L);
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));
		Map<Long, RankingGroup> groups =
				Map.of(1L, RankingGroup.OPTIONAL, 2L, RankingGroup.MUST_CONTINUE);

		assertThatThrownBy(() -> DependencyOrderRepair.repair(ordered, links, groups))
				.isInstanceOf(BrokenDependencyOrderException.class);
	}

	@Test
	void repair_throwsWhenEveryRemainingTaskWaitsOnAnother() {
		List<Long> ordered = List.of(1L, 2L);
		List<DependencyLink> links =
				List.of(new DependencyLink(1L, 2L, true), new DependencyLink(2L, 1L, true));
		Map<Long, RankingGroup> groups =
				Map.of(1L, RankingGroup.DUE_OR_OVERDUE, 2L, RankingGroup.DUE_OR_OVERDUE);

		assertThatThrownBy(() -> DependencyOrderRepair.repair(ordered, links, groups))
				.isInstanceOf(BrokenDependencyOrderException.class);
	}
}
