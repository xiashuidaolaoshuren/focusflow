package com.focusflow.schedule;

import java.time.LocalTime;
import java.util.List;

public record RevisionView(int revisionNumber, LocalTime cutoff, List<RevisionBlock> blocks) {}
