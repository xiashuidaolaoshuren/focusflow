package com.focusflow.schedule;

public record UnplacedWork(long sourceTaskId, UnplacedReason reason, Integer unplacedMinutes) {}
