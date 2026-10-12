package com.focusflow.dependency;

import com.focusflow.task.TaskStatus;
import java.time.LocalDate;

public record RankingCandidate(long taskId, TaskStatus status, LocalDate dueDate) {}
