package com.focusflow.preferences;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

final class WorkingDaysPreference {

	private WorkingDaysPreference() {}

	static List<DayOfWeek> defaultWorkingDays() {
		return List.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS);
	}

	static Set<DayOfWeek> defaultWorkingDaySet() {
		return Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS);
	}

	static List<DayOfWeek> fromEntity(SchedulingPreferences preferences) {
		List<DayOfWeek> days = new ArrayList<>();
		if (preferences.isWorkingMonday()) {
			days.add(DayOfWeek.MONDAY);
		}
		if (preferences.isWorkingTuesday()) {
			days.add(DayOfWeek.TUESDAY);
		}
		if (preferences.isWorkingWednesday()) {
			days.add(DayOfWeek.WEDNESDAY);
		}
		if (preferences.isWorkingThursday()) {
			days.add(DayOfWeek.THURSDAY);
		}
		if (preferences.isWorkingFriday()) {
			days.add(DayOfWeek.FRIDAY);
		}
		if (preferences.isWorkingSaturday()) {
			days.add(DayOfWeek.SATURDAY);
		}
		if (preferences.isWorkingSunday()) {
			days.add(DayOfWeek.SUNDAY);
		}
		return List.copyOf(days);
	}

	static void applyToEntity(SchedulingPreferences preferences, List<DayOfWeek> workingDays) {
		Set<DayOfWeek> selected = new LinkedHashSet<>(workingDays);
		preferences.setWorkingMonday(selected.contains(DayOfWeek.MONDAY));
		preferences.setWorkingTuesday(selected.contains(DayOfWeek.TUESDAY));
		preferences.setWorkingWednesday(selected.contains(DayOfWeek.WEDNESDAY));
		preferences.setWorkingThursday(selected.contains(DayOfWeek.THURSDAY));
		preferences.setWorkingFriday(selected.contains(DayOfWeek.FRIDAY));
		preferences.setWorkingSaturday(selected.contains(DayOfWeek.SATURDAY));
		preferences.setWorkingSunday(selected.contains(DayOfWeek.SUNDAY));
	}
}
