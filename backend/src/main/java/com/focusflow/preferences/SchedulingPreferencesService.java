package com.focusflow.preferences;

import com.focusflow.preferences.dto.FixedBreakRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesResponse;
import com.focusflow.security.CurrentUser;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SchedulingPreferencesService {

	private final SchedulingPreferencesRepository schedulingPreferencesRepository;
	private final CurrentUser currentUser;
	private final OwnerSchedulingLock ownerSchedulingLock;

	public SchedulingPreferencesService(
			SchedulingPreferencesRepository schedulingPreferencesRepository,
			CurrentUser currentUser,
			OwnerSchedulingLock ownerSchedulingLock) {
		this.schedulingPreferencesRepository = schedulingPreferencesRepository;
		this.currentUser = currentUser;
		this.ownerSchedulingLock = ownerSchedulingLock;
	}

	@Transactional(readOnly = true)
	public SchedulingPreferencesResponse getEffective() {
		Long ownerId = currentUser.getCurrentUser().id();
		return schedulingPreferencesRepository
				.findByOwner_Id(ownerId)
				.map(preferences -> toResponse(preferences, true))
				.orElseGet(this::defaultResponse);
	}

	@Transactional
	public SchedulingPreferencesResponse put(SchedulingPreferencesRequest request) {
		SchedulingPreferencesValidator.validate(request);
		Long ownerId = currentUser.getCurrentUser().id();
		User owner = ownerSchedulingLock.lockCurrentOwner();
		SchedulingPreferences preferences =
				schedulingPreferencesRepository
						.findByOwner_Id(ownerId)
						.orElseGet(
								() -> {
									SchedulingPreferences created = new SchedulingPreferences();
									created.setOwner(owner);
									return created;
								});
		applyRequest(preferences, request);
		return toResponse(schedulingPreferencesRepository.save(preferences), true);
	}

	private void applyRequest(SchedulingPreferences preferences, SchedulingPreferencesRequest request) {
		preferences.setWorkDayStart(request.workDayStart());
		preferences.setWorkDayEnd(request.workDayEnd());
		preferences.setCadenceEnabled(request.cadenceEnabled());
		preferences.setTargetFocusMinutes(request.targetFocusMinutes());
		preferences.setBreakMinutes(request.breakMinutes());
		preferences.setMinSessionMinutes(request.minSessionMinutes());
		preferences.setBufferMinutes(request.bufferMinutes());
		preferences.setPeakStart(request.peakStart());
		preferences.setPeakEnd(request.peakEnd());
		replaceFixedBreaks(preferences, request.fixedBreaks());
	}

	private void replaceFixedBreaks(
			SchedulingPreferences preferences, List<FixedBreakRequest> fixedBreakRequests) {
		preferences.getFixedBreaks().clear();
		if (fixedBreakRequests == null) {
			return;
		}
		for (FixedBreakRequest breakRequest : fixedBreakRequests) {
			FixedBreak fixedBreak = new FixedBreak();
			fixedBreak.setSchedulingPreferences(preferences);
			fixedBreak.setLabel(breakRequest.label());
			fixedBreak.setStartTime(breakRequest.startTime());
			fixedBreak.setEndTime(breakRequest.endTime());
			preferences.getFixedBreaks().add(fixedBreak);
		}
	}

	private SchedulingPreferencesResponse defaultResponse() {
		return new SchedulingPreferencesResponse(
				SchedulingPreferenceDefaults.WORK_DAY_START,
				SchedulingPreferenceDefaults.WORK_DAY_END,
				SchedulingPreferenceDefaults.CADENCE_ENABLED,
				SchedulingPreferenceDefaults.TARGET_FOCUS_MINUTES,
				SchedulingPreferenceDefaults.BREAK_MINUTES,
				SchedulingPreferenceDefaults.MIN_SESSION_MINUTES,
				SchedulingPreferenceDefaults.BUFFER_MINUTES,
				null,
				null,
				List.of(),
				false);
	}

	private SchedulingPreferencesResponse toResponse(
			SchedulingPreferences preferences, boolean persisted) {
		return new SchedulingPreferencesResponse(
				preferences.getWorkDayStart(),
				preferences.getWorkDayEnd(),
				preferences.isCadenceEnabled(),
				preferences.getTargetFocusMinutes(),
				preferences.getBreakMinutes(),
				preferences.getMinSessionMinutes(),
				preferences.getBufferMinutes(),
				preferences.getPeakStart(),
				preferences.getPeakEnd(),
				preferences.getFixedBreaks().stream()
						.map(
								breakItem ->
										new com.focusflow.preferences.dto.FixedBreakResponse(
												breakItem.getLabel(),
												breakItem.getStartTime(),
												breakItem.getEndTime()))
						.toList(),
				persisted);
	}
}
