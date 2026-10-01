package com.focusflow.schedule;

public enum UnavailableSegmentKind {
	FIXED_BREAK,
	COMMITMENT,
	BUFFER;

	public BlockKind toBlockKind() {
		return switch (this) {
			case FIXED_BREAK -> BlockKind.FIXED_BREAK;
			case COMMITMENT -> BlockKind.COMMITMENT;
			case BUFFER -> BlockKind.BUFFER;
		};
	}
}