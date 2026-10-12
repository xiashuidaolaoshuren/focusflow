package com.focusflow.dependency;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class InheritedRankingTest {

	private static final LocalDate PLAN_DATE = LocalDate.of(2026, 10, 12);

	@Test
	void assign_doesNotInheritThroughDoneIntermediate() {
		List<RankingCandidate> candidates =
				List.of(
						new RankingCandidate(1L, TaskStatus.OPEN, null),
						new RankingCandidate(3L, TaskStatus.OPEN, PLAN_DATE));
		List<DependencyLink> links =
				List.of(
						new DependencyLink(1L, 2L, true),
						new DependencyLink(2L, 3L, false));

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, PLAN_DATE, Set.of());

		assertThat(assignmentFor(assignments, 1L))
				.satisfies(
						a -> {
							assertThat(a.group()).isEqualTo(RankingGroup.OPTIONAL);
							assertThat(a.neededForTaskId()).isEqualTo(1L);
							assertThat(a.inheritedDueDate()).isNull();
						});
	}

	@Test
	void assign_openBlockerInheritsDueUrgencyFromBlockedTask() {
		List<RankingCandidate> candidates =
				List.of(
						new RankingCandidate(1L, TaskStatus.OPEN, null),
						new RankingCandidate(2L, TaskStatus.OPEN, PLAN_DATE));
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, PLAN_DATE, Set.of());

		assertThat(assignmentFor(assignments, 1L))
				.satisfies(
						a -> {
							assertThat(a.group()).isEqualTo(RankingGroup.DUE_OR_OVERDUE);
							assertThat(a.neededForTaskId()).isEqualTo(2L);
							assertThat(a.inheritedDueDate()).isEqualTo(PLAN_DATE);
						});
	}

	@Test
	void assign_inProgressBlockerKeepsMustContinueAndNamesSelf() {
		List<RankingCandidate> candidates =
				List.of(
						new RankingCandidate(1L, TaskStatus.IN_PROGRESS, null),
						new RankingCandidate(2L, TaskStatus.OPEN, PLAN_DATE));
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, PLAN_DATE, Set.of());

		assertThat(assignmentFor(assignments, 1L))
				.satisfies(
						a -> {
							assertThat(a.group()).isEqualTo(RankingGroup.MUST_CONTINUE);
							assertThat(a.neededForTaskId()).isEqualTo(1L);
							assertThat(a.inheritedDueDate()).isEqualTo(PLAN_DATE);
						});
	}

	@Test
	void assign_neededForPrefersEarliestDueDateThenLowestTaskId() {
		LocalDate earlier = PLAN_DATE.minusDays(1);
		List<RankingCandidate> candidates =
				List.of(
						new RankingCandidate(1L, TaskStatus.OPEN, null),
						new RankingCandidate(20L, TaskStatus.OPEN, earlier),
						new RankingCandidate(10L, TaskStatus.OPEN, PLAN_DATE));
		List<DependencyLink> links =
				List.of(new DependencyLink(1L, 20L, true), new DependencyLink(1L, 10L, true));

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, PLAN_DATE, Set.of());

		assertThat(assignmentFor(assignments, 1L).neededForTaskId()).isEqualTo(20L);

		List<RankingCandidate> tiedDue =
				List.of(
						new RankingCandidate(1L, TaskStatus.OPEN, null),
						new RankingCandidate(20L, TaskStatus.OPEN, PLAN_DATE),
						new RankingCandidate(10L, TaskStatus.OPEN, PLAN_DATE));
		List<InheritedAssignment> tiedAssignments =
				InheritedRanking.assign(tiedDue, links, PLAN_DATE, Set.of());

		assertThat(assignmentFor(tiedAssignments, 1L).neededForTaskId()).isEqualTo(10L);
	}

	@Test
	void assign_forecastMustContinuePropagatesToUnfinishedBlocker() {
		List<RankingCandidate> candidates =
				List.of(
						new RankingCandidate(1L, TaskStatus.OPEN, null),
						new RankingCandidate(2L, TaskStatus.OPEN, null));
		List<DependencyLink> links = List.of(new DependencyLink(1L, 2L, true));

		List<InheritedAssignment> assignments =
				InheritedRanking.assign(candidates, links, PLAN_DATE, Set.of(2L));

		assertThat(assignmentFor(assignments, 1L))
				.satisfies(
						a -> {
							assertThat(a.group()).isEqualTo(RankingGroup.MUST_CONTINUE);
							assertThat(a.neededForTaskId()).isEqualTo(2L);
						});
		assertThat(assignmentFor(assignments, 2L).group()).isEqualTo(RankingGroup.MUST_CONTINUE);
	}

	private static InheritedAssignment assignmentFor(
			List<InheritedAssignment> assignments, long taskId) {
		return assignments.stream()
				.filter(a -> a.taskId() == taskId)
				.findFirst()
				.orElseThrow();
	}
}
