package com.focusflow.preferences;

import java.time.LocalTime;

public record EffectiveFixedBreak(String label, LocalTime startTime, LocalTime endTime) {}
