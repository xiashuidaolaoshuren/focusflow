package com.focusflow.schedule;

import java.time.LocalTime;

public record WorkWindow(LocalTime start, LocalTime end) {}