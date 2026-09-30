package com.focusflow.preferences;

import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SchedulingPreferencesQueryService {

	private final SchedulingPreferencesRepository schedulingPreferencesRepository;

	public SchedulingPreferencesQueryService(
			SchedulingPreferencesRepository schedulingPreferencesRepository) {
		this.schedulingPreferencesRepository = schedulingPreferencesRepository;
	}

	@Transactional(readOnly = true)
	public EffectiveSchedulingPreferences effectiveFor(Long ownerId) {
		return schedulingPreferencesRepository
				.findByOwner_Id(ownerId)
				.map(this::toEffective)
				.orElseGet(this::defaults);
	}

	private EffectiveSchedulingPreferences defaults() {
		return new EffectiveSchedulingPreferences(
				SchedulingPreferenceDefaults.WORK_DAY_START,
				SchedulingPreferenceDefaults.WORK_DAY_END,
				SchedulingPreferenceDefaults.CADENCE_ENABLED,
				SchedulingPreferenceDefaults.TARGET_FOCUS_MINUTES,
				SchedulingPreferenceDefaults.BREAK_MINUTES,
				SchedulingPreferenceDefaults.MIN_SESSION_MINUTES,
				SchedulingPreferenceDefaults.BUFFER_MINUTES,
				null,
				null,
				List.of());
	}

	private EffectiveSchedulingPreferences toEffective(SchedulingPreferences preferences) {
		List<EffectiveFixedBreak> fixedBreaks =
				preferences.getFixedBreaks().stream()
						.map(
								breakItem ->
										new EffectiveFixedBreak(
												breakItem.getLabel(),
												breakItem.getStartTime(),
												breakItem.getEndTime()))
						.toList();
		return new EffectiveSchedulingPreferences(
				preferences.getWorkDayStart(),
				preferences.getWorkDayEnd(),
				preferences.isCadenceEnabled(),
				preferences.getTargetFocusMinutes(),
				preferences.getBreakMinutes(),
				preferences.getMinSessionMinutes(),
				preferences.getBufferMinutes(),
				preferences.getPeakStart(),
				preferences.getPeakEnd(),
				fixedBreaks);
	}
}
