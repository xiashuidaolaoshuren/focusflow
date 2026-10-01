package com.focusflow.schedule;

import java.time.LocalTime;

public record CommitmentWindow(String title, LocalTime start, LocalTime end) {}