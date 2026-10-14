package com.focusflow.horizon;

import static org.assertj.core.api.Assertions.assertThat;

import com.focusflow.dependency.BrokenDependencyOrderException;
import com.focusflow.dependency.DependencyLink;
import com.focusflow.horizon.HorizonForecast.CreditExclusion;
import com.focusflow.horizon.HorizonForecast.DeadlineStatus;
import com.focusflow.horizon.HorizonForecast.UnplacedScope;
import com.focusflow.horizon.HorizonInput.HorizonTask;
import com.focusflow.horizon.HorizonInput.LatestCheckpoint;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferenceDefaults;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class HorizonForecasterTest {

	private static final LocalDate MONDAY = LocalDate.of(2026, 6, 1);

	@Test
	void forecast_mondayStartWithMonThroughFriWorkingDays_yieldsSevenWorkingForecastColumns() {
		HorizonForecast forecast =
				HorizonForecaster.forecast(
						baseInput(MONDAY, LocalTime.of(9, 0), List.of(), List.of()));

		assertThat(forecast.days())
				.extracting(HorizonForecast.HorizonDay::date, HorizonForecast.HorizonDay::kind)
				.containsExactly(
						org.assertj.core.groups.Tuple.tuple(MONDAY, HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 2), HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 3), HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 4), HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 5), HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 8), HorizonForecast.DayKind.FORECAST),
						org.assertj.core.groups.Tuple.tuple(
								LocalDate.of(2026, 6, 9), HorizonForecast.DayKind.FORECAST));
	}

	@Test
	void forecast_savedSaturday_addsSavedColumnWithoutConsumingOneOfSevenWorkingDays() {
		LocalDate saturday = LocalDate.of(2026, 6, 6);
		HorizonInput input =
				baseInput(
						MONDAY,
						LocalTime.of(9, 0),
						List.of(
								new HorizonInput.SavedPlanDay(
										saturday,
										99L,
										false,
										List.of(),
										List.of())),
						List.of());

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(forecast.days()).hasSize(8);
		assertThat(forecast.days())
				.filteredOn(day -> day.date().equals(saturday))
				.singleElement()
				.satisfies(
						day -> {
							assertThat(day.kind()).isEqualTo(HorizonForecast.DayKind.SAVED);
							assertThat(day.planId()).isEqualTo(99L);
						});
		long workingForecastCount =
				forecast.days().stream()
						.filter(
								day ->
										day.kind() == HorizonForecast.DayKind.FORECAST
												&& isWorkingDay(day.date()))
						.count();
		assertThat(workingForecastCount).isEqualTo(7);
	}

	private static boolean isWorkingDay(LocalDate date) {
		return SchedulingPreferenceDefaults.WORKING_DAYS.contains(date.getDayOfWeek());
	}

	@Test
	void forecast_savedDay_echoesDisplayedMinutesPlanMetadataAndSavedShortfall() {
		HorizonTask liveTask = openTask(1L, "Alpha", 80);
		HorizonTask savedOnly = openTask(99L, "Ghost", null);
		HorizonInput input =
				new HorizonInput(
						MONDAY,
						LocalTime.of(9, 0),
						defaultPreferences(),
						List.of(liveTask),
						List.of(savedOnly),
						List.of(),
						Map.of(),
						Map.of(),
						List.of(
								new HorizonInput.SavedPlanDay(
										MONDAY,
										10L,
										true,
										List.of(
												session(1L, "09:00", "10:00", false, false, false, null),
												session(99L, "10:00", "10:30", false, false, false, null)),
										List.of(
												new HorizonInput.SavedUnplacedRow(
														1L, UnplacedReason.OUT_OF_TIME, 30)))));

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(forecast.days().getFirst().planId()).isEqualTo(10L);
		assertThat(forecast.days().getFirst().needsRefresh()).isTrue();
		HorizonForecast.HorizonTaskRow alpha = row(forecast, 1L);
		assertThat(alpha.segments()).anyMatch(segment -> segment.minutes() == 60);
		assertThat(alpha.segments())
				.anySatisfy(
						segment -> {
							assertThat(segment.unplacedReason()).isEqualTo(UnplacedReason.OUT_OF_TIME);
							assertThat(segment.unplacedScope()).isEqualTo(UnplacedScope.SAVED_SHORTFALL);
						});
		assertThat(row(forecast, 99L).segments()).anyMatch(segment -> segment.minutes() == 30);
	}

	@Test
	void forecast_carry_creditsUnrecordedSessionsAndCapsRunningRemainder() {
		HorizonTask task = openTask(1L, "Work", 80);
		HorizonInput input =
				baseInput(
						MONDAY,
						LocalTime.of(9, 0),
						List.of(
								savedDay(
										MONDAY,
										1L,
										List.of(session(1L, "09:00", "09:50", false, false, false, null))),
								savedDay(
										LocalDate.of(2026, 6, 2),
										2L,
										List.of(session(1L, "09:00", "10:00", false, false, false, null)))),
						List.of(task));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		HorizonForecast.HorizonTaskRow row = row(forecast, 1L);

		assertThat(row.segments().getFirst().assumedCreditMinutes()).isEqualTo(50);
		assertThat(row.segments().get(1).assumedCreditMinutes()).isEqualTo(30);
	}

	@Test
	void forecast_recordedSessionConsumesNoAssumedCredit() {
		HorizonTask task = openTask(1L, "Work", 80);
		HorizonInput input =
				baseInput(
						MONDAY,
						LocalTime.of(9, 0),
						List.of(
								savedDay(
										MONDAY,
										1L,
										List.of(
												session(1L, "09:00", "10:00", true, false, false, null),
												session(1L, "10:00", "10:30", false, false, false, null)))),
						List.of(task));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		HorizonForecast.HorizonTaskRow row = row(forecast, 1L);

		assertThat(row.segments().getFirst().assumedCreditMinutes()).isNull();
		assertThat(row.segments().get(1).assumedCreditMinutes()).isEqualTo(30);
	}

	@Test
	void forecast_checkpointOnOrBeforeWorkDateExcludesCreditUnlessRevisionCapturedCheckpoint() {
		HorizonTask task = openTask(1L, "Work", 80);
		HorizonInput input =
				new HorizonInput(
						MONDAY,
						LocalTime.of(9, 0),
						defaultPreferences(),
						List.of(task),
						List.of(),
						List.of(),
						Map.of(1L, new LatestCheckpoint(5L, MONDAY)),
						Map.of(),
						List.of(
								savedDay(
										MONDAY,
										1L,
										List.of(
												session(1L, "09:00", "10:00", false, false, false, 4L),
												session(1L, "10:00", "10:30", false, false, false, 5L)))));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		HorizonForecast.HorizonTaskRow row = row(forecast, 1L);

		assertThat(row.segments().getFirst().creditExclusions())
				.containsExactly(CreditExclusion.CHECKPOINT);
		assertThat(row.segments().getFirst().assumedCreditMinutes()).isNull();
		assertThat(row.segments().get(1).assumedCreditMinutes()).isEqualTo(30);
	}

	@Test
	void forecast_dependencyBlocksEarlySessionButLaterSameDaySessionCanCredit() {
		HorizonTask blocker = inProgressTask(1L, "Blocker", 60);
		HorizonTask blocked = openTask(2L, "Blocked", 40);
		HorizonInput input =
				new HorizonInput(
						MONDAY,
						LocalTime.of(9, 0),
						defaultPreferences(),
						List.of(blocker, blocked),
						List.of(),
						List.of(new DependencyLink(1L, 2L, true)),
						Map.of(),
						Map.of(),
						List.of(
								savedDay(
										MONDAY,
										1L,
										List.of(
												session(2L, "09:00", "09:30", false, false, false, null),
												session(1L, "09:30", "10:30", false, false, false, null),
												session(2L, "10:30", "11:00", false, false, false, null)))));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		HorizonForecast.HorizonTaskRow row = row(forecast, 2L);

		assertThat(row.segments().getFirst().creditExclusions())
				.containsExactly(CreditExclusion.DEPENDENCY);
		assertThat(row.segments())
				.filteredOn(segment -> segment.assumedCreditMinutes() != null)
				.last()
				.extracting(HorizonForecast.HorizonSegment::assumedCreditMinutes)
				.isEqualTo(30);
		assertThat(forecast.days().getFirst().dependenciesIgnored()).containsExactly(2L);
	}

	@Test
	void forecast_inProgressTaskOrdersBeforeOptionalOnFirstWorkingDay() {
		HorizonTask inProgress = inProgressTask(1L, "Continue", 30);
		HorizonTask optional = openTask(2L, "Later", 30);
		HorizonInput input =
				baseInput(MONDAY, LocalTime.of(9, 0), List.of(), List.of(inProgress, optional));

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(forecast.tasks()).extracting(HorizonForecast.HorizonTaskRow::taskId)
				.containsSubsequence(1L, 2L);
	}

	@Test
	void forecast_whenDependencyRepairHasNoLegalTask_throwsBrokenDependencyOrderException() {
		HorizonTask first = openTask(1L, "First", 30);
		HorizonTask second = openTask(2L, "Second", 30);
		HorizonInput input =
				new HorizonInput(
						MONDAY,
						LocalTime.of(9, 0),
						defaultPreferences(),
						List.of(first, second),
						List.of(),
						List.of(
								new DependencyLink(1L, 2L, true),
								new DependencyLink(2L, 1L, true)),
						Map.of(),
						Map.of(),
						List.of());

		assertThatThrownBy(() -> HorizonForecaster.forecast(input))
				.isInstanceOf(BrokenDependencyOrderException.class);
	}

	@Test
	void forecast_todayAfterWindowEndPlacesNothingThatDay() {
		HorizonTask task = openTask(1L, "Work", 120);
		HorizonInput input =
				baseInput(MONDAY, LocalTime.of(18, 0), List.of(), List.of(task));

		HorizonForecast forecast = HorizonForecaster.forecast(input);
		HorizonForecast.HorizonTaskRow row = row(forecast, 1L);

		assertThat(row.segments()).noneMatch(segment -> segment.date().equals(MONDAY));
	}

	@Test
	void forecast_projectedFinishDateIsFirstZeroCrossingNotLaterDisplay() {
		HorizonTask task = openTask(1L, "Work", 50);
		HorizonInput input =
				baseInput(
						MONDAY,
						LocalTime.of(9, 0),
						List.of(
								savedDay(
										MONDAY,
										1L,
										List.of(session(1L, "09:00", "09:50", false, false, false, null))),
								savedDay(
										LocalDate.of(2026, 6, 2),
										2L,
										List.of(session(1L, "09:00", "10:00", false, false, false, null)))),
						List.of(task));

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(row(forecast, 1L).projectedFinishDate()).isEqualTo(MONDAY);
	}

	@Test
	void forecast_deadlineStatusPrecedenceAndLists() {
		HorizonTask overdue = openTask(1L, "Overdue", 10);
		overdue =
				new HorizonTask(
						1L,
						"Overdue",
						TaskStatus.OPEN,
						TaskPriority.MEDIUM,
						MONDAY.minusDays(1),
						10);
		HorizonTask unknownChain =
				new HorizonTask(2L, "Unknown", TaskStatus.OPEN, TaskPriority.MEDIUM, MONDAY, 20);
		HorizonTask blocker = openTask(3L, "Blocker", null);
		HorizonInput input =
				new HorizonInput(
						MONDAY,
						LocalTime.of(9, 0),
						defaultPreferences(),
						List.of(overdue, unknownChain, blocker),
						List.of(),
						List.of(new DependencyLink(3L, 2L, true)),
						Map.of(),
						Map.of(),
						List.of());

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(row(forecast, 1L).deadlineStatus()).isEqualTo(DeadlineStatus.OVERDUE);
		assertThat(row(forecast, 2L).deadlineStatus()).isEqualTo(DeadlineStatus.CANNOT_FORECAST);
		assertThat(row(forecast, 2L).unresolvedEffort())
				.extracting(HorizonForecast.TaskRef::taskId)
				.containsExactly(3L);
	}

	@Test
	void forecast_everyPlannableTaskHasRowEvenWithNoSegments() {
		HorizonTask task = openTask(7L, "Quiet", 0);
		HorizonInput input = baseInput(MONDAY, LocalTime.of(9, 0), List.of(), List.of(task));

		HorizonForecast forecast = HorizonForecaster.forecast(input);

		assertThat(row(forecast, 7L).segments()).isEmpty();
	}

	private static HorizonForecast.HorizonTaskRow row(HorizonForecast forecast, long taskId) {
		return forecast.tasks().stream()
				.filter(row -> row.taskId() == taskId)
				.findFirst()
				.orElseThrow();
	}

	private static HorizonInput.SavedPlanDay savedDay(
			LocalDate date, long planId, List<HorizonInput.SavedSession> sessions) {
		return new HorizonInput.SavedPlanDay(date, planId, false, sessions, List.of());
	}

	private static HorizonInput.SavedSession session(
			long taskId,
			String start,
			String end,
			boolean outcomeRecorded,
			boolean reconciled,
			boolean noLongerNeeded,
			Long capturedCheckpointId) {
		return new HorizonInput.SavedSession(
				taskId,
				LocalTime.parse(start),
				LocalTime.parse(end),
				outcomeRecorded,
				reconciled,
				noLongerNeeded,
				capturedCheckpointId);
	}

	private static HorizonTask openTask(long id, String title, Integer remainder) {
		return new HorizonTask(
				id, title, TaskStatus.OPEN, TaskPriority.MEDIUM, null, remainder);
	}

	private static HorizonTask inProgressTask(long id, String title, Integer remainder) {
		return new HorizonTask(
				id, title, TaskStatus.IN_PROGRESS, TaskPriority.MEDIUM, null, remainder);
	}

	private static HorizonInput baseInput(
			LocalDate currentDate,
			LocalTime currentTime,
			List<HorizonInput.SavedPlanDay> savedDays,
			List<HorizonTask> plannableTasks) {
		return new HorizonInput(
				currentDate,
				currentTime,
				defaultPreferences(),
				plannableTasks,
				List.of(),
				List.of(),
				Map.of(),
				Map.of(),
				savedDays);
	}

	private static EffectiveSchedulingPreferences defaultPreferences() {
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
				List.of(),
				Set.copyOf(SchedulingPreferenceDefaults.WORKING_DAYS));
	}
}
