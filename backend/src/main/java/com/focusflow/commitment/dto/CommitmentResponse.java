package com.focusflow.commitment.dto;

import java.time.LocalDate;
import java.time.LocalTime;

public record CommitmentResponse(
		Long id,
		String title,
		LocalDate commitmentDate,
		LocalTime startTime,
		LocalTime endTime) {}
