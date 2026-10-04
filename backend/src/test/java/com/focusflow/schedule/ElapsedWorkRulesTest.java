package com.focusflow.schedule;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.effort.WorkOutcome;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

class ElapsedWorkRulesTest {

	private static final LocalTime CUTOFF = LocalTime.of(14, 0);

	@Test
	void classify_whenBlockStartsAtOrAfterCutoff_isEarlyCompletionOrSuperseded() {
		RevisionBlock earlyDone =
				workBlock(
						1,
						LocalTime.of(15, 0),
						LocalTime.of(16, 0),
						WorkOutcome.DONE,
						false,
						false);
		RevisionBlock superseded =
				workBlock(2, LocalTime.of(15, 0), LocalTime.of(16, 0), null, false, false);
		RevisionBlock atCutoff =
				workBlock(
						3,
						CUTOFF,
						LocalTime.of(15, 0),
						WorkOutcome.PARTLY_DONE,
						false,
						false);

		ElapsedWork elapsed =
				ElapsedWorkRules.classify(List.of(earlyDone, superseded, atCutoff), CUTOFF);

		assertThat(elapsed.earlyCompletions()).containsExactly(earlyDone, atCutoff);
		assertThat(elapsed.superseded()).containsExactly(superseded);
		assertThat(elapsed.unresolvedElapsed()).isEmpty();
	}

	@Test
	void classify_whenBlockCrossesCutoff_isUnreconciledCrossingUnlessReconciledOrNoLongerNeeded() {
		RevisionBlock crossing =
				workBlock(1, LocalTime.of(13, 30), LocalTime.of(14, 30), null, false, false);
		RevisionBlock endAtCutoff =
				workBlock(2, LocalTime.of(13, 0), CUTOFF, null, false, false);
		RevisionBlock reconciledCrossing =
				workBlock(3, LocalTime.of(13, 30), LocalTime.of(14, 30), null, true, false);
		RevisionBlock noLongerNeededCrossing =
				workBlock(4, LocalTime.of(13, 30), LocalTime.of(14, 30), null, false, true);

		ElapsedWork elapsed =
				ElapsedWorkRules.classify(
						List.of(
								crossing,
								endAtCutoff,
								reconciledCrossing,
								noLongerNeededCrossing),
						CUTOFF);

		assertThat(elapsed.unreconciledCrossing()).containsExactly(crossing);
		assertThat(elapsed.unresolvedElapsed()).containsExactly(endAtCutoff);
	}

	@Test
	void classify_whenElapsedWorkHasOutcomeOrIsNoLongerNeeded_isNotUnresolved() {
		RevisionBlock skipped =
				workBlock(
						1,
						LocalTime.of(9, 0),
						LocalTime.of(10, 0),
						WorkOutcome.SKIPPED,
						false,
						false);
		RevisionBlock noLongerNeeded =
				workBlock(2, LocalTime.of(10, 0), LocalTime.of(11, 0), null, false, true);

		ElapsedWork elapsed =
				ElapsedWorkRules.classify(List.of(skipped, noLongerNeeded), CUTOFF);

		assertThat(elapsed.unresolvedElapsed()).isEmpty();
	}

	@Test
	void classify_whenElapsedWorkHasNoOutcome_isUnresolved() {
		RevisionBlock block =
				workBlock(1, LocalTime.of(9, 0), LocalTime.of(10, 0), null, false, false);

		ElapsedWork elapsed = ElapsedWorkRules.classify(List.of(block), CUTOFF);

		assertThat(elapsed.unresolvedElapsed()).containsExactly(block);
		assertThat(elapsed.unreconciledCrossing()).isEmpty();
		assertThat(elapsed.earlyCompletions()).isEmpty();
		assertThat(elapsed.superseded()).isEmpty();
	}

	private static RevisionBlock workBlock(
			long sourceTaskId,
			LocalTime start,
			LocalTime end,
			WorkOutcome outcome,
			boolean reconciled,
			boolean noLongerNeeded) {
		return new RevisionBlock(
				1,
				BlockKind.WORK,
				start,
				end,
				sourceTaskId,
				null,
				outcome,
				null,
				reconciled,
				noLongerNeeded);
	}
}
