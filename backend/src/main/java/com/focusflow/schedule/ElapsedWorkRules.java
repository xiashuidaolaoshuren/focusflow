package com.focusflow.schedule;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

public final class ElapsedWorkRules {

	private ElapsedWorkRules() {}

	public static ElapsedWork classify(List<RevisionBlock> blocks, LocalTime cutoff) {
		List<RevisionBlock> unresolvedElapsed = new ArrayList<>();
		List<RevisionBlock> unreconciledCrossing = new ArrayList<>();
		List<RevisionBlock> earlyCompletions = new ArrayList<>();
		List<RevisionBlock> superseded = new ArrayList<>();

		for (RevisionBlock block : blocks) {
			if (block.kind() != BlockKind.WORK) {
				continue;
			}
			if (isCrossing(block, cutoff)) {
				if (!block.reconciled() && !block.noLongerNeeded()) {
					unreconciledCrossing.add(block);
				}
				continue;
			}
			if (isUnresolvedElapsed(block, cutoff)) {
				unresolvedElapsed.add(block);
				continue;
			}
			if (!block.start().isBefore(cutoff)) {
				if (block.outcome() != null) {
					earlyCompletions.add(block);
				} else {
					superseded.add(block);
				}
			}
		}

		return new ElapsedWork(unresolvedElapsed, unreconciledCrossing, earlyCompletions, superseded);
	}

	private static boolean isCrossing(RevisionBlock block, LocalTime cutoff) {
		return block.start().isBefore(cutoff) && block.end().isAfter(cutoff);
	}

	private static boolean isUnresolvedElapsed(RevisionBlock block, LocalTime cutoff) {
		return !block.end().isAfter(cutoff)
				&& block.outcome() == null
				&& !block.noLongerNeeded();
	}
}
