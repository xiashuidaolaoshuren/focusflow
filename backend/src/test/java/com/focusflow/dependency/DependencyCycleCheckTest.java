package com.focusflow.dependency;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class DependencyCycleCheckTest {

	@Test
	void wouldCycle_selfLink() {
		assertThat(DependencyCycleCheck.wouldCycle(List.of(), 1L, 1L)).isTrue();
	}

	@Test
	void wouldCycle_existingAcyclicPairIsNotCycle() {
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));
		assertThat(DependencyCycleCheck.wouldCycle(links, 1L, 2L)).isFalse();
	}

	@Test
	void wouldCycle_detectsCycleThroughNonPlannableLink() {
		List<DependencyLink> links =
				List.of(new DependencyLink(1L, 2L, false), new DependencyLink(2L, 3L, true));
		assertThat(DependencyCycleCheck.wouldCycle(links, 3L, 1L)).isTrue();
	}

	@Test
	void wouldCycle_acyclicExtension() {
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));
		assertThat(DependencyCycleCheck.wouldCycle(links, 2L, 3L)).isFalse();
	}
}
