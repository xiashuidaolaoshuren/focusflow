package com.focusflow.commitment.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.LocalTime;

public record CommitmentRequest(
		@NotBlank @Size(max = 255) String title,
		@NotNull LocalDate commitmentDate,
		@NotNull LocalTime startTime,
		@NotNull LocalTime endTime) {}
