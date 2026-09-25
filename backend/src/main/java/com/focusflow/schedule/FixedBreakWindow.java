package com.focusflow.schedule;

import java.time.LocalTime;

public record FixedBreakWindow(String label, LocalTime start, LocalTime end) {}