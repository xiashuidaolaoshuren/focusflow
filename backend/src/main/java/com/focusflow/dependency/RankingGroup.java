package com.focusflow.dependency;

public enum RankingGroup {
	MUST_CONTINUE,
	DUE_OR_OVERDUE,
	OPTIONAL;

	public boolean isMoreUrgentThan(RankingGroup other) {
		return this.ordinal() < other.ordinal();
	}

	public RankingGroup mostUrgent(RankingGroup other) {
		return isMoreUrgentThan(other) ? this : other;
	}
}
