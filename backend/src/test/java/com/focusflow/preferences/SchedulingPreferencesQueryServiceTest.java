package com.focusflow.preferences;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SchedulingPreferencesQueryServiceTest {

	@Mock
	private SchedulingPreferencesRepository schedulingPreferencesRepository;

	private SchedulingPreferencesQueryService schedulingPreferencesQueryService;

	@BeforeEach
	void setUp() {
		schedulingPreferencesQueryService =
				new SchedulingPreferencesQueryService(schedulingPreferencesRepository);
	}

	@Test
	void effectiveFor_whenNoRow_returnsDefaultWorkingDays() {
		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.empty());

		EffectiveSchedulingPreferences effective =
				schedulingPreferencesQueryService.effectiveFor(42L);

		assertThat(effective.workingDays())
				.containsExactlyInAnyOrder(
						DayOfWeek.MONDAY,
						DayOfWeek.TUESDAY,
						DayOfWeek.WEDNESDAY,
						DayOfWeek.THURSDAY,
						DayOfWeek.FRIDAY);
	}

	@Test
	void effectiveFor_whenRowExists_returnsPersistedWorkingDays() {
		SchedulingPreferences preferences = new SchedulingPreferences();
		preferences.setWorkDayStart(LocalTime.of(9, 0));
		preferences.setWorkDayEnd(LocalTime.of(18, 0));
		preferences.setCadenceEnabled(true);
		preferences.setTargetFocusMinutes(50);
		preferences.setBreakMinutes(10);
		preferences.setMinSessionMinutes(15);
		preferences.setBufferMinutes(0);
		preferences.setWorkingMonday(false);
		preferences.setWorkingTuesday(true);
		preferences.setWorkingWednesday(false);
		preferences.setWorkingThursday(true);
		preferences.setWorkingFriday(false);
		preferences.setWorkingSaturday(true);
		preferences.setWorkingSunday(false);

		when(schedulingPreferencesRepository.findByOwner_Id(42L))
				.thenReturn(Optional.of(preferences));

		EffectiveSchedulingPreferences effective =
				schedulingPreferencesQueryService.effectiveFor(42L);

		assertThat(effective.workingDays())
				.containsExactlyInAnyOrder(
						DayOfWeek.TUESDAY, DayOfWeek.THURSDAY, DayOfWeek.SATURDAY);
	}
}
