package com.focusflow.preferences;

import java.time.LocalTime;

public final class SchedulingPreferenceDefaults {

	public static final LocalTime WORK_DAY_START = LocalTime.of(9, 0);
	public static final LocalTime WORK_DAY_END = LocalTime.of(18, 0);
	public static final boolean CADENCE_ENABLED = true;
	public static final int TARGET_FOCUS_MINUTES = 50;
	public static final int BREAK_MINUTES = 10;
	public static final int MIN_SESSION_MINUTES = 15;
	public static final int BUFFER_MINUTES = 0;

	private SchedulingPreferenceDefaults() {}
}
