package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.ai.AiDailyPlanRequest;
import com.focusflow.ai.AiDailyPlanResponse;
import com.focusflow.ai.AiPlanItem;
import com.focusflow.ai.AiProviderException;
import com.focusflow.ai.DailyPlanAiClient;
import com.focusflow.commitment.CommitmentQueryService;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.common.web.PageResponse;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.DailyPlanSummaryResponse;
import com.focusflow.plan.dto.DailyPlanWarning;
import com.focusflow.plan.dto.GeneratePlanRequest;
import com.focusflow.preferences.EffectiveSchedulingPreferences;
import com.focusflow.preferences.SchedulingPreferencesQueryService;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.schedule.CommitmentWindow;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskQueryService;
import com.focusflow.testsupport.DailyPlanResponseTestSupport;
import com.focusflow.schedule.SchedulePostconditionException;
import com.focusflow.schedule.SchedulePostconditionViolation;
import com.focusflow.task.TaskStatus;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.LocalTime;
import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.annotation.AnnotationUtils;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.mockito.Spy;

@ExtendWith(MockitoExtension.class)
class DailyPlanServiceTest {

	@Mock
	private DailyPlanAiClient aiClient;

	@Mock
	private TaskQueryService taskQueryService;

	@Mock
	private CurrentUser currentUser;

	@Mock
	private DailyPlanRepository dailyPlanRepository;

	@Mock
	private DailyPlanPersister persister;

	@Mock
	private DailyPlanScheduler scheduler;

	@Mock
	private OwnerSchedulingLock ownerSchedulingLock;

	@Mock
	private SchedulingPreferencesQueryService schedulingPreferencesQueryService;

	@Mock
	private CommitmentQueryService commitmentQueryService;

	@Spy
	private DailyPlanRankingValidator rankingValidator =
			new DailyPlanRankingValidator(new SimpleMeterRegistry());

	private final DailyPlanResponseMapper responseMapper = new DailyPlanResponseMapper();

	private DailyPlanService dailyPlanService;

	@BeforeEach
	void setUp() {
		dailyPlanService =
				new DailyPlanService(
						aiClient,
						taskQueryService,
						currentUser,
						dailyPlanRepository,
						persister,
						responseMapper,
						rankingValidator,
						scheduler,
						ownerSchedulingLock,
						schedulingPreferencesQueryService,
						commitmentQueryService);
		lenient()
				.when(
						dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
								anyLong(), any()))
				.thenReturn(Optional.empty());
	}

	private List<Task> plannableTasks(int count) {
		return IntStream.rangeClosed(1, count)
				.mapToObj(
						i -> {
							Task task = new Task();
							ReflectionTestUtils.setField(task, "id", (long) i);
							task.setTitle("Task " + i);
							task.setStatus(TaskStatus.OPEN);
							task.setPriority(TaskPriority.MEDIUM);
							return task;
						})
				.toList();
	}

	private DailyPlan existingPlan(long id, LocalDate planDate) {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", id);
		plan.setPlanDate(planDate);
		plan.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		return plan;
	}

	private DailyPlanSchedule stubSchedule() {
		return new DailyPlanSchedule(
				LocalTime.of(9, 0),
				LocalTime.of(18, 0),
				null,
				null,
				480,
				60,
				0L,
				0,
				0,
				List.of(),
				List.of());
	}

	private DailyPlanResponse stubPersisterReturnWithWarning(DailyPlanWarning warning) {
		DailyPlanResponse response =
				DailyPlanResponseTestSupport.minimal(
						null,
						LocalDate.of(2026, 6, 1),
						Instant.parse("2026-06-01T09:00:00Z"),
						warning);
		when(persister.persistPlan(any(), any(), any(), any(), any(), any())).thenReturn(response);
		return response;
	}

	private void stubPersisterReturn(DailyPlanResponse response) {
		when(persister.persistPlan(any(), any(), any(), any(), any(), any())).thenReturn(response);
	}

	private void stubSchedulerCompose() {
		when(scheduler.compose(any(), any(), any(), any())).thenReturn(stubSchedule());
	}

	@Test
	void generate_delegatesToTransactionalPersistPlan() throws Exception {
		Method generate = DailyPlanService.class.getMethod("generate", GeneratePlanRequest.class);
		assertThat(AnnotationUtils.findAnnotation(generate, Transactional.class)).isNull();

		Method persistPlan =
				DailyPlanPersister.class.getMethod(
						"persistPlan",
						Long.class,
						LocalDate.class,
						Long.class,
						List.class,
						List.class,
						DailyPlanSchedule.class);
		assertThat(AnnotationUtils.findAnnotation(persistPlan, Transactional.class)).isNotNull();

		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setPriority(TaskPriority.MEDIUM);
		task.setEstimatedMinutes(30);

		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		DailyPlanSchedule schedule = stubSchedule();
		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		dailyPlanService.generate(new GeneratePlanRequest(planDate, null));

		verify(aiClient).generate(any(AiDailyPlanRequest.class));
		verify(scheduler).compose(eq(planDate), eq(List.of(task)), any(), any());
		verify(persister)
				.persistPlan(
						eq(42L),
						eq(planDate),
						eq(null),
						eq(List.of(new AiPlanItem(1L, 1))),
						eq(List.of(task)),
						eq(schedule));
	}

	@Test
	void generate_loadsSchedulingInputsBeforeProviderCall() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setPriority(TaskPriority.MEDIUM);
		task.setEstimatedMinutes(30);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		EffectiveSchedulingPreferences preferences = defaultEffectivePreferences();
		List<CommitmentWindow> commitments =
				List.of(new CommitmentWindow("Standup", LocalTime.of(10, 0), LocalTime.of(10, 30)));
		lenient().when(schedulingPreferencesQueryService.effectiveFor(42L)).thenReturn(preferences);
		lenient().when(commitmentQueryService.windowsFor(42L, planDate)).thenReturn(commitments);
		lenient()
				.when(scheduler.compose(planDate, List.of(task), preferences, commitments))
				.thenReturn(stubSchedule());
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));
		stubPersisterReturnWithWarning(null);

		dailyPlanService.generate(new GeneratePlanRequest(planDate, null));

		InOrder inOrder = inOrder(schedulingPreferencesQueryService, commitmentQueryService, aiClient);
		inOrder.verify(schedulingPreferencesQueryService).effectiveFor(42L);
		inOrder.verify(commitmentQueryService).windowsFor(42L, planDate);
		inOrder.verify(aiClient).generate(any(AiDailyPlanRequest.class));
		verify(scheduler).compose(planDate, List.of(task), preferences, commitments);
	}

	private EffectiveSchedulingPreferences defaultEffectivePreferences() {
		return new EffectiveSchedulingPreferences(
				LocalTime.of(9, 0),
				LocalTime.of(18, 0),
				true,
				50,
				10,
				15,
				0,
				null,
				null,
				List.of());
	}

	@Test
	void generate_callsAiClientWithCurrentUserActiveTasks() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Write tests");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		dailyPlanService.generate(new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null));

		ArgumentCaptor<AiDailyPlanRequest> captor = ArgumentCaptor.forClass(AiDailyPlanRequest.class);
		verify(aiClient).generate(captor.capture());
		assertThat(captor.getValue().tasks()).hasSize(1);
		assertThat(captor.getValue().planDate()).isEqualTo(LocalDate.of(2026, 6, 1));
	}

	@Test
	void generate_whenNoPlannableTasks_rejectsBeforeProviderCall() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of());

		assertThatThrownBy(() -> dailyPlanService.generate(new GeneratePlanRequest(null, null)))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("no plannable tasks available for planning");

		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenMoreThan100Candidates_throwsPlanCandidateLimitBeforeAi() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(plannableTasks(101));

		assertThatThrownBy(
						() ->
								dailyPlanService.generate(
										new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null)))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("PLAN_CANDIDATE_LIMIT"));

		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenLatestPlanExistsAndNoReplaceId_throwsPlanExists() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, planDate))
				.thenReturn(Optional.of(existingPlan(5L, planDate)));

		assertThatThrownBy(
						() -> dailyPlanService.generate(new GeneratePlanRequest(planDate, null)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_EXISTS"));

		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenReplacePlanIdMatchesLatest_persistsPlan() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, planDate))
				.thenReturn(Optional.of(existingPlan(5L, planDate)));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setPriority(TaskPriority.MEDIUM);
		task.setEstimatedMinutes(30);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		DailyPlanSchedule schedule = stubSchedule();
		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		dailyPlanService.generate(new GeneratePlanRequest(planDate, 5L));

		verify(persister)
				.persistPlan(
						eq(42L),
						eq(planDate),
						eq(5L),
						eq(List.of(new AiPlanItem(1L, 1))),
						eq(List.of(task)),
						eq(schedule));
	}

	@Test
	void generate_whenReplacePlanIdButNoPlan_throwsPlanChanged() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);

		assertThatThrownBy(
						() -> dailyPlanService.generate(new GeneratePlanRequest(planDate, 5L)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_CHANGED"));

		verify(taskQueryService, never()).findPlannableTasksByOwnerId(anyLong());
		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenReplacePlanIdStale_throwsPlanChanged() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, planDate))
				.thenReturn(Optional.of(existingPlan(5L, planDate)));

		assertThatThrownBy(
						() -> dailyPlanService.generate(new GeneratePlanRequest(planDate, 9L)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_CHANGED"));

		verify(taskQueryService, never()).findPlannableTasksByOwnerId(anyLong());
		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenLatestPlanExistsAndTooManyCandidates_throwsPlanExistsNotCandidateLimit() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, planDate))
				.thenReturn(Optional.of(existingPlan(5L, planDate)));

		assertThatThrownBy(
						() -> dailyPlanService.generate(new GeneratePlanRequest(planDate, null)))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_EXISTS"));

		verify(taskQueryService, never()).findPlannableTasksByOwnerId(anyLong());
		verify(aiClient, never()).generate(any());
		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_delegatesToRankingValidator() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setStatus(TaskStatus.IN_PROGRESS);
		task.setPriority(TaskPriority.MEDIUM);
		task.setEstimatedMinutes(30);

		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		dailyPlanService.generate(new GeneratePlanRequest(planDate, null));

		verify(rankingValidator).validateOrder(List.of(task), planDate, List.of(1L));
	}

	@Test
	void generate_whenOnlyInProgressTasks_callsProvider() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.IN_PROGRESS);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		dailyPlanService.generate(new GeneratePlanRequest(planDate, null));

		ArgumentCaptor<AiDailyPlanRequest> captor = ArgumentCaptor.forClass(AiDailyPlanRequest.class);
		verify(aiClient).generate(captor.capture());
		assertThat(captor.getValue().tasks()).hasSize(1);
		assertThat(captor.getValue().tasks().getFirst().status()).isEqualTo(TaskStatus.IN_PROGRESS);
	}

	@Test
	void generate_doesNotFallbackToTodayWhenPlanDateNull() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Task 1");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		stubSchedulerCompose();
		stubPersisterReturnWithWarning(null);

		dailyPlanService.generate(new GeneratePlanRequest(null, null));

		ArgumentCaptor<AiDailyPlanRequest> captor = ArgumentCaptor.forClass(AiDailyPlanRequest.class);
		verify(aiClient).generate(captor.capture());
		assertThat(captor.getValue().planDate()).isNull();
	}

	@Test
	void generate_whenAiClientThrows_propagatesAiProviderException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		task.setTitle("Task 1");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenThrow(new AiProviderException("provider down"));

		assertThatThrownBy(
						() ->
								dailyPlanService.generate(
										new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null)))
				.isInstanceOf(AiProviderException.class)
				.hasMessage("provider down");
	}

	@Test
	void generate_delegatesPersistPlanAndReturnsResponse() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Task 1");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));

		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		DailyPlanSchedule schedule = stubSchedule();
		stubSchedulerCompose();
		DailyPlanResponse stubbed = stubPersisterReturnWithWarning(null);

		DailyPlanResponse response =
				dailyPlanService.generate(new GeneratePlanRequest(planDate, null));

		verify(persister)
				.persistPlan(
						eq(42L),
						eq(planDate),
						eq(null),
						eq(List.of(new AiPlanItem(1L, 1))),
						eq(List.of(task)),
						eq(schedule));
		assertThat(response).isSameAs(stubbed);
	}

	@Test
	void generate_whenSchedulePostconditionFails_doesNotPersist() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.IN_PROGRESS);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(1L)));
		when(scheduler.compose(any(), any(), any(), any()))
				.thenThrow(
						new SchedulePostconditionException(
								SchedulePostconditionViolation.OUT_OF_WINDOW,
								"work outside window"));

		assertThatThrownBy(
						() ->
								dailyPlanService.generate(
										new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null)))
				.isInstanceOf(SchedulePostconditionException.class);

		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenRankingValidationFails_doesNotSave() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", 1L);
		task.setTitle("Continue work");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.IN_PROGRESS);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of()));

		assertThatThrownBy(
						() ->
								dailyPlanService.generate(
										new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null)))
				.isInstanceOf(AiProviderException.class);

		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void generate_whenAiReturnsUnknownTaskId_throwsAiProviderException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		Task task = new Task();
		task.setTitle("Task 1");
		task.setPriority(TaskPriority.HIGH);
		task.setStatus(TaskStatus.OPEN);
		when(taskQueryService.findPlannableTasksByOwnerId(42L)).thenReturn(List.of(task));
		when(aiClient.generate(any(AiDailyPlanRequest.class)))
				.thenReturn(new AiDailyPlanResponse(List.of(999L)));

		assertThatThrownBy(
						() ->
								dailyPlanService.generate(
										new GeneratePlanRequest(LocalDate.of(2026, 6, 1), null)))
				.isInstanceOf(AiProviderException.class);

		verify(scheduler, never()).compose(any(), any(), any(), any());
		verify(persister, never()).persistPlan(any(), any(), any(), any(), any(), any());
	}

	@Test
	void listForCurrentUser_mapsScheduledSummaryCounts() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		DailyPlanSummaryProjection projection =
				new DailyPlanSummaryProjection() {
					@Override
					public Long getId() {
						return 1L;
					}

					@Override
					public LocalDate getPlanDate() {
						return LocalDate.of(2026, 6, 1);
					}

					@Override
					public Instant getCreatedAt() {
						return Instant.parse("2026-06-01T09:00:00Z");
					}

					@Override
					public Integer getScheduledWorkMinutes() {
						return 180;
					}

					@Override
					public Integer getWorkSessionCount() {
						return 3;
					}

					@Override
					public Integer getScheduledTaskCount() {
						return 2;
					}

					@Override
					public Integer getUnplacedWorkCount() {
						return 1;
					}

					@Override
					public Boolean getHasWarning() {
						return true;
					}
				};
		when(dailyPlanRepository.findSummariesByOwner(eq(42L), eq(PageRequest.of(0, 20))))
				.thenReturn(new PageImpl<>(List.of(projection), PageRequest.of(0, 20), 1));

		PageResponse<DailyPlanSummaryResponse> response = dailyPlanService.listForCurrentUser(0, 20);

		assertThat(response.content())
				.singleElement()
				.satisfies(
						summary -> {
							assertThat(summary.id()).isEqualTo(1L);
							assertThat(summary.planDate()).isEqualTo(LocalDate.of(2026, 6, 1));
							assertThat(summary.scheduledWorkMinutes()).isEqualTo(180);
							assertThat(summary.workSessionCount()).isEqualTo(3);
							assertThat(summary.scheduledTaskCount()).isEqualTo(2);
							assertThat(summary.unplacedWorkCount()).isEqualTo(1);
							assertThat(summary.hasWarning()).isTrue();
						});
		assertThat(response.page()).isZero();
		assertThat(response.size()).isEqualTo(20);
		assertThat(response.totalElements()).isEqualTo(1L);
		assertThat(response.totalPages()).isEqualTo(1);
	}

	@Test
	void listForCurrentUser_whenSizeExceedsMax_throwsBadRequestException() {
		assertThatThrownBy(() -> dailyPlanService.listForCurrentUser(0, 101))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("size must be between 1 and 100");
	}

	@Test
	void byDateForCurrentUser_returnsNewestPlanForDate() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		LocalDate planDate = LocalDate.of(2026, 6, 1);
		DailyPlan newer = new DailyPlan();
		ReflectionTestUtils.setField(newer, "id", 2L);
		newer.setPlanDate(planDate);
		newer.setCreatedAt(Instant.parse("2026-06-01T14:00:00Z"));
		newer.setWindowStart(java.time.LocalTime.of(9, 0));
		newer.setWindowEnd(java.time.LocalTime.of(18, 0));

		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, planDate))
				.thenReturn(Optional.of(newer));

		Optional<DailyPlanResponse> response = dailyPlanService.byDateForCurrentUser(planDate);

		assertThat(response)
				.isPresent()
				.get()
				.satisfies(plan -> assertThat(plan.id()).isEqualTo(2L));
	}

	@Test
	void byDateForCurrentUser_whenNoneExist_returnsEmpty() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						42L, LocalDate.of(2026, 6, 1)))
				.thenReturn(Optional.empty());

		assertThat(dailyPlanService.byDateForCurrentUser(LocalDate.of(2026, 6, 1))).isEmpty();
	}

	@Test
	void byDateForCurrentUser_whenPlanDateMissing_throwsBadRequestException() {
		assertThatThrownBy(() -> dailyPlanService.byDateForCurrentUser(null))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("planDate is required");
	}

	@Test
	void getForCurrentUser_whenOwnedPlanExists_returnsMappedResponse() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));

		DailyPlan plan = new DailyPlan();
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		plan.setCreatedAt(Instant.parse("2026-06-01T09:00:00Z"));
		plan.setWindowStart(java.time.LocalTime.of(9, 0));
		plan.setWindowEnd(java.time.LocalTime.of(18, 0));
		when(dailyPlanRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(plan));

		DailyPlanResponse response = dailyPlanService.getForCurrentUser(7L);

		verify(dailyPlanRepository).findByOwner_IdAndId(eq(42L), eq(7L));
		assertThat(response.planDate()).isEqualTo(LocalDate.of(2026, 6, 1));
		assertThat(response.blocks()).isEmpty();
		assertThat(response.warning()).isNull();
	}

	@Test
	void getForCurrentUser_whenMissing_throwsNotFoundException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));
		when(dailyPlanRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> dailyPlanService.getForCurrentUser(99L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("daily plan not found");
	}

	@Test
	void deleteForCurrentUser_whenOwned_locksOwnerAndDeletesPlan() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));
		User owner = new User();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);

		DailyPlan plan = new DailyPlan();
		plan.setPlanDate(LocalDate.of(2026, 6, 1));
		when(dailyPlanRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(Optional.of(plan));

		dailyPlanService.deleteForCurrentUser(7L);

		verify(ownerSchedulingLock).lockCurrentOwner();
		verify(dailyPlanRepository).delete(plan);
	}

	@Test
	void deleteForCurrentUser_whenMissing_throwsNotFoundException() {
		when(currentUser.getCurrentUser())
				.thenReturn(new UserContext(42L, "user@example.com", "user"));
		when(dailyPlanRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> dailyPlanService.deleteForCurrentUser(99L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("daily plan not found");

		verify(dailyPlanRepository, never()).delete(any(DailyPlan.class));
	}
}
