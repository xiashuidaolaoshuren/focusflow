package com.focusflow.schedule;

import java.time.LocalTime;

public sealed interface CutoffDecision {

	record Accepted(LocalTime effectiveCutoff) implements CutoffDecision {}

	record Rejected() implements CutoffDecision {}
}
