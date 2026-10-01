package com.focusflow.preferences;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.preferences.dto.FixedBreakRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesRequest;
import com.focusflow.preferences.dto.SchedulingPreferencesResponse;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.lang.reflect.Method;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class SchedulingPreferencesServiceTest {

	@Mock
	private SchedulingPreferencesRepository schedulingPreferencesRepository;

	@Mock
	private CurrentUser currentUser;

	@Mock
	private OwnerSchedulingLock ownerSchedulingLock;

	private SchedulingPreferencesService schedulingPreferencesService;

	@BeforeEach
	void setUp() {
		schedulingPreferencesService =
				new SchedulingPreferencesService(
						schedulingPreferencesRepository, currentUser, ownerSchedulingLock);
	}

	@Test
	void getEffective_isReadOnlyTransactional() throws Exception {
		Method method = SchedulingPreferencesService.class.getMethod("getEffective");

		Transactional transactional = method.getAnnotation(Transactional.class);

		assertThat(transactional).isNotNull();
		assertThat(transactional.readOnly()).isTrue();
	}

	@Test
	void put_whenCadenceDisabled_retainsTargetAndBreakWithoutEnforcingCadenceRules() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.empty());
		when(schedulingPreferencesRepository.save(any(SchedulingPreferences.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withCadenceEnabled(false)
						.withTargetFocusMinutes(10)
						.withMinSessionMinutes(15)
						.withBreakMinutes(0)
						.build();

		SchedulingPreferencesResponse response = schedulingPreferencesService.put(request);

		ArgumentCaptor<SchedulingPreferences> captor = ArgumentCaptor.forClass(SchedulingPreferences.class);
		verify(schedulingPreferencesRepository).save(captor.capture());
		SchedulingPreferences saved = captor.getValue();
		assertThat(saved.isCadenceEnabled()).isFalse();
		assertThat(saved.getTargetFocusMinutes()).isEqualTo(10);
		assertThat(saved.getBreakMinutes()).isZero();
		assertThat(response.cadenceEnabled()).isFalse();
		assertThat(response.targetFocusMinutes()).isEqualTo(10);
		assertThat(response.breakMinutes()).isZero();
	}

	@Test
	void put_whenWorkDayEndNotAfterStart_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withWorkDayStart(LocalTime.of(18, 0))
						.withWorkDayEnd(LocalTime.of(9, 0))
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("work day end must be after work day start");
	}

	@Test
	void put_whenTimeNotMinuteAligned_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder().withWorkDayStart(LocalTime.of(9, 0, 30)).build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("times must be minute-aligned");
	}

	@Test
	void put_whenCadenceEnabledAndTargetFocusBelowMinSession_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withCadenceEnabled(true)
						.withTargetFocusMinutes(10)
						.withMinSessionMinutes(15)
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("target focus minutes must be at least min session minutes");
	}

	@Test
	void put_whenBufferNotLessThanWindowLength_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withWorkDayStart(LocalTime.of(9, 0))
						.withWorkDayEnd(LocalTime.of(18, 0))
						.withBufferMinutes(540)
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("buffer minutes must be less than work window length");
	}

	@Test
	void put_whenPeakWindowOutsideWorkWindow_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withPeakStart(LocalTime.of(8, 0))
						.withPeakEnd(LocalTime.of(10, 0))
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("peak window must lie inside the work window");
	}

	@Test
	void put_whenFixedBreakOutsideWorkWindow_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withFixedBreaks(
								List.of(
										new FixedBreakRequest(
												"Lunch", LocalTime.of(8, 30), LocalTime.of(9, 30))))
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("fixed break must lie wholly inside the work window");
	}

	@Test
	void put_whenFixedBreaksOverlap_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withFixedBreaks(
								List.of(
										new FixedBreakRequest(
												"Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0)),
										new FixedBreakRequest(
												"Meeting", LocalTime.of(12, 30), LocalTime.of(13, 30))))
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("fixed breaks must not overlap");
	}

	@Test
	void put_whenFixedBreakLabelBlank_throwsBadRequestException() {
		SchedulingPreferencesRequest request =
				validRequestBuilder()
						.withFixedBreaks(
								List.of(new FixedBreakRequest("   ", LocalTime.of(12, 0), LocalTime.of(13, 0))))
						.build();

		assertThatThrownBy(() -> schedulingPreferencesService.put(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("fixed break label must not be blank");
	}

	@Test
	void put_whenRowExists_replacesAllFixedBreaks() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);

		SchedulingPreferences existing = new SchedulingPreferences();
		existing.setOwner(owner);
		existing.setWorkDayStart(LocalTime.of(9, 0));
		existing.setWorkDayEnd(LocalTime.of(18, 0));
		existing.setCadenceEnabled(true);
		existing.setTargetFocusMinutes(50);
		existing.setBreakMinutes(10);
		existing.setMinSessionMinutes(15);
		existing.setBufferMinutes(0);

		FixedBreak oldBreak = new FixedBreak();
		oldBreak.setSchedulingPreferences(existing);
		oldBreak.setLabel("Old lunch");
		oldBreak.setStartTime(LocalTime.of(12, 0));
		oldBreak.setEndTime(LocalTime.of(13, 0));
		existing.getFixedBreaks().add(oldBreak);

		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.of(existing));
		when(schedulingPreferencesRepository.save(any(SchedulingPreferences.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		SchedulingPreferencesRequest request =
				new SchedulingPreferencesRequest(
						LocalTime.of(9, 0),
						LocalTime.of(18, 0),
						true,
						50,
						10,
						15,
						0,
						null,
						null,
						List.of(new FixedBreakRequest("Coffee", LocalTime.of(15, 0), LocalTime.of(15, 15))));

		SchedulingPreferencesResponse response = schedulingPreferencesService.put(request);

		assertThat(existing.getFixedBreaks()).singleElement().satisfies(breakItem -> {
			assertThat(breakItem.getLabel()).isEqualTo("Coffee");
			assertThat(breakItem.getStartTime()).isEqualTo(LocalTime.of(15, 0));
			assertThat(breakItem.getEndTime()).isEqualTo(LocalTime.of(15, 15));
		});
		assertThat(response.fixedBreaks()).singleElement().satisfies(breakItem -> {
			assertThat(breakItem.label()).isEqualTo("Coffee");
		});
	}

	@Test
	void put_whenNoRow_locksOwnerCreatesAggregateWithBreaks() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.empty());
		when(schedulingPreferencesRepository.save(any(SchedulingPreferences.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		SchedulingPreferencesRequest request =
				new SchedulingPreferencesRequest(
						LocalTime.of(9, 0),
						LocalTime.of(18, 0),
						true,
						50,
						10,
						15,
						0,
						null,
						null,
						List.of(new FixedBreakRequest("Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0))));

		SchedulingPreferencesResponse response = schedulingPreferencesService.put(request);

		verify(ownerSchedulingLock).lockCurrentOwner();
		ArgumentCaptor<SchedulingPreferences> captor = ArgumentCaptor.forClass(SchedulingPreferences.class);
		verify(schedulingPreferencesRepository).save(captor.capture());
		SchedulingPreferences saved = captor.getValue();
		assertThat(saved.getOwner()).isSameAs(owner);
		assertThat(saved.getWorkDayStart()).isEqualTo(LocalTime.of(9, 0));
		assertThat(saved.getWorkDayEnd()).isEqualTo(LocalTime.of(18, 0));
		assertThat(saved.getFixedBreaks()).singleElement().satisfies(breakItem -> {
			assertThat(breakItem.getLabel()).isEqualTo("Lunch");
			assertThat(breakItem.getStartTime()).isEqualTo(LocalTime.of(12, 0));
			assertThat(breakItem.getEndTime()).isEqualTo(LocalTime.of(13, 0));
			assertThat(breakItem.getSchedulingPreferences()).isSameAs(saved);
		});
		assertThat(response.persisted()).isTrue();
		assertThat(response.fixedBreaks()).singleElement().satisfies(breakItem -> {
			assertThat(breakItem.label()).isEqualTo("Lunch");
			assertThat(breakItem.startTime()).isEqualTo(LocalTime.of(12, 0));
			assertThat(breakItem.endTime()).isEqualTo(LocalTime.of(13, 0));
		});
	}

	@Test
	void getEffective_whenRowExists_returnsPersistedValues() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		SchedulingPreferences preferences = new SchedulingPreferences();
		preferences.setWorkDayStart(LocalTime.of(8, 0));
		preferences.setWorkDayEnd(LocalTime.of(17, 0));
		preferences.setCadenceEnabled(false);
		preferences.setTargetFocusMinutes(40);
		preferences.setBreakMinutes(8);
		preferences.setMinSessionMinutes(20);
		preferences.setBufferMinutes(15);
		preferences.setPeakStart(LocalTime.of(10, 0));
		preferences.setPeakEnd(LocalTime.of(14, 0));

		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.of(preferences));

		SchedulingPreferencesResponse response = schedulingPreferencesService.getEffective();

		assertThat(response.persisted()).isTrue();
		assertThat(response.workDayStart()).isEqualTo(LocalTime.of(8, 0));
		assertThat(response.workDayEnd()).isEqualTo(LocalTime.of(17, 0));
		assertThat(response.cadenceEnabled()).isFalse();
		assertThat(response.targetFocusMinutes()).isEqualTo(40);
		assertThat(response.breakMinutes()).isEqualTo(8);
		assertThat(response.minSessionMinutes()).isEqualTo(20);
		assertThat(response.bufferMinutes()).isEqualTo(15);
		assertThat(response.peakStart()).isEqualTo(LocalTime.of(10, 0));
		assertThat(response.peakEnd()).isEqualTo(LocalTime.of(14, 0));
		assertThat(response.fixedBreaks()).isEmpty();
	}

	@Test
	void getEffective_whenNoRow_returnsDefaultsPersistedFalse() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.empty());

		SchedulingPreferencesResponse response = schedulingPreferencesService.getEffective();

		assertThat(response.persisted()).isFalse();
		assertThat(response.workDayStart()).isEqualTo(LocalTime.of(9, 0));
		assertThat(response.workDayEnd()).isEqualTo(LocalTime.of(18, 0));
		assertThat(response.cadenceEnabled()).isTrue();
		assertThat(response.targetFocusMinutes()).isEqualTo(50);
		assertThat(response.breakMinutes()).isEqualTo(10);
		assertThat(response.minSessionMinutes()).isEqualTo(15);
		assertThat(response.bufferMinutes()).isZero();
		assertThat(response.peakStart()).isNull();
		assertThat(response.peakEnd()).isNull();
		assertThat(response.fixedBreaks()).isEmpty();
	}

	private void stubOwnerLock() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(schedulingPreferencesRepository.findByOwner_Id(42L)).thenReturn(Optional.empty());
		when(schedulingPreferencesRepository.save(any(SchedulingPreferences.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
	}

	private static ValidRequestBuilder validRequestBuilder() {
		return new ValidRequestBuilder();
	}

	private static final class ValidRequestBuilder {

		private LocalTime workDayStart = LocalTime.of(9, 0);
		private LocalTime workDayEnd = LocalTime.of(18, 0);
		private boolean cadenceEnabled = true;
		private int targetFocusMinutes = 50;
		private int breakMinutes = 10;
		private int minSessionMinutes = 15;
		private int bufferMinutes = 0;
		private LocalTime peakStart;
		private LocalTime peakEnd;
		private List<FixedBreakRequest> fixedBreaks = List.of();

		ValidRequestBuilder withWorkDayStart(LocalTime workDayStart) {
			this.workDayStart = workDayStart;
			return this;
		}

		ValidRequestBuilder withWorkDayEnd(LocalTime workDayEnd) {
			this.workDayEnd = workDayEnd;
			return this;
		}

		ValidRequestBuilder withCadenceEnabled(boolean cadenceEnabled) {
			this.cadenceEnabled = cadenceEnabled;
			return this;
		}

		ValidRequestBuilder withTargetFocusMinutes(int targetFocusMinutes) {
			this.targetFocusMinutes = targetFocusMinutes;
			return this;
		}

		ValidRequestBuilder withMinSessionMinutes(int minSessionMinutes) {
			this.minSessionMinutes = minSessionMinutes;
			return this;
		}

		ValidRequestBuilder withBreakMinutes(int breakMinutes) {
			this.breakMinutes = breakMinutes;
			return this;
		}

		ValidRequestBuilder withBufferMinutes(int bufferMinutes) {
			this.bufferMinutes = bufferMinutes;
			return this;
		}

		ValidRequestBuilder withPeakStart(LocalTime peakStart) {
			this.peakStart = peakStart;
			return this;
		}

		ValidRequestBuilder withPeakEnd(LocalTime peakEnd) {
			this.peakEnd = peakEnd;
			return this;
		}

		ValidRequestBuilder withFixedBreaks(List<FixedBreakRequest> fixedBreaks) {
			this.fixedBreaks = fixedBreaks;
			return this;
		}

		SchedulingPreferencesRequest build() {
			return new SchedulingPreferencesRequest(
					workDayStart,
					workDayEnd,
					cadenceEnabled,
					targetFocusMinutes,
					breakMinutes,
					minSessionMinutes,
					bufferMinutes,
					peakStart,
					peakEnd,
					fixedBreaks);
		}
	}
}
