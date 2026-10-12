package com.focusflow.schedule;

import java.util.List;

public record ElapsedWork(
		List<RevisionBlock> unresolvedElapsed,
		List<RevisionBlock> unreconciledCrossing,
		List<RevisionBlock> earlyCompletions,
		List<RevisionBlock> superseded) {}
