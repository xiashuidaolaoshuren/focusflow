package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.common.error.ConflictException;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.schedule.UnplacedWork;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskQueryService;
import com.focusflow.task.TaskStatus;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

@ExtendWith(MockitoExtension.class)
class DailyPlanPersisterTest {

	@Mock
	private OwnerSchedulingLock ownerSchedulingLock;

	@Mock
	private TaskQueryService taskQueryService;

	@Mock
	private DailyPlanRepository dailyPlanRepository;

	private DailyPlanResponseMapper responseMapper;

	private DailyPlanPersister persister;

	@BeforeEach
	void setUp() {
		responseMapper = new DailyPlanResponseMapper();
		persister =
				new DailyPlanPersister(
						ownerSchedulingLock,
						taskQueryService,
						dailyPlanRepository,
						responseMapper);
	}

	@Test
	void persistPlan_isTransactional() throws Exception {
		Method method =
				DailyPlanPersister.class.getMethod(
						"persistPlan",
						Long.class,
						LocalDate.class,
						Long.class,
						List.class,
						DailyPlanSchedule.class);

		assertThat(method.isAnnotationPresent(Transactional.class)).isTrue();
	}

	@Test
	void persistPlan_persistsScheduleFieldsBlocksAndUnplaced() {
		User owner = new User();
		Task task = createTask(1L, "Continue work", 60, TaskStatus.IN_PROGRESS);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));
		DailyPlanSchedule schedule = sampleSchedule();

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.empty());
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(task));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		DailyPlanResponse response =
				persister.persistPlan(1L, planDate, null, aiItems, schedule);

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		DailyPlan savedPlan = captor.getValue();
		assertThat(savedPlan.getOwner()).isSameAs(owner);
		assertThat(savedPlan.getPlanDate()).isEqualTo(planDate);
		assertThat(savedPlan.getWindowStart()).isEqualTo(LocalTime.of(9, 0));
		assertThat(savedPlan.getWindowEnd()).isEqualTo(LocalTime.of(18, 0));
		assertThat(savedPlan.getFreeMinutes()).isEqualTo(480);
		assertThat(savedPlan.getScheduledWorkMinutes()).isEqualTo(60);
		assertThat(savedPlan.getRequiredMinutes()).isEqualTo(60L);
		assertThat(savedPlan.getTasks()).hasSize(1);
		assertThat(savedPlan.getTasks().get(0).getTaskReference()).isSameAs(task);
		assertThat(savedPlan.getTasks().get(0).getRank()).isEqualTo(1);
		assertThat(savedPlan.getTasks().get(0).isMustInclude()).isTrue();
		assertThat(savedPlan.getTasks().get(0).getUnplacedReason())
				.isEqualTo(UnplacedReason.OUT_OF_TIME);
		assertThat(savedPlan.getTasks().get(0).getUnplacedMinutes()).isEqualTo(30);
		assertThat(savedPlan.getBlocks())
				.singleElement()
				.satisfies(
						block -> {
							assertThat(block.getKind()).isEqualTo(BlockKind.WORK);
							assertThat(block.getStartTime()).isEqualTo(LocalTime.of(9, 0));
							assertThat(block.getEndTime()).isEqualTo(LocalTime.of(10, 0));
							assertThat(block.getPosition()).isEqualTo(1);
							assertThat(block.getDailyPlanTask())
									.isSameAs(savedPlan.getTasks().get(0));
						});
		assertThat(response.planDate()).isEqualTo(planDate);
		assertThat(response.freeMinutes()).isEqualTo(480);
		assertThat(response.blocks()).hasSize(1);
	}

	@Test
	void persistPlan_underLock_whenPlanExistsWithoutReplace_throwsPlanExists() {
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlan(5L, planDate);

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(new User());
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.of(existing));

		assertThatThrownBy(
						() ->
								persister.persistPlan(
										1L,
										planDate,
										null,
										List.of(new AiPlanItem(1L, 1)),
										sampleSchedule()))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_EXISTS"));

		verify(dailyPlanRepository, never()).save(any(DailyPlan.class));
	}

	@Test
	void persistPlan_underLock_whenReplaceIdStale_throwsPlanChanged() {
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlan(5L, planDate);

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(new User());
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.of(existing));

		assertThatThrownBy(
						() ->
								persister.persistPlan(
										1L,
										planDate,
										9L,
										List.of(new AiPlanItem(1L, 1)),
										sampleSchedule()))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_CHANGED"));

		verify(dailyPlanRepository, never()).save(any(DailyPlan.class));
	}

	@Test
	void persistPlan_onReplace_deletesExistingPlanBeforeSave() {
		User owner = new User();
		Task task = createTask(1L, "Continue work", 60, TaskStatus.IN_PROGRESS);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlan(5L, planDate);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));
		DailyPlanSchedule schedule = sampleSchedule();

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.of(existing));
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(task));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, 5L, aiItems, schedule);

		verify(dailyPlanRepository).delete(existing);
		verify(dailyPlanRepository).save(any(DailyPlan.class));
	}

	@Test
	void persistPlan_whenSelectedTaskDisappeared_throwsCodedConflictException() {
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(new User());
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.empty());
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of());

		assertThatThrownBy(
						() -> persister.persistPlan(1L, planDate, null, aiItems, sampleSchedule()))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex -> {
							assertThat(((ConflictException) ex).getCode())
									.isEqualTo("TASK_MISSING_DURING_GENERATION");
							assertThat(ex).hasMessage("a selected task is no longer available");
						});
	}

	private DailyPlan existingPlan(long id, LocalDate planDate) {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", id);
		plan.setPlanDate(planDate);
		return plan;
	}

	private DailyPlanSchedule sampleSchedule() {
		return new DailyPlanSchedule(
				LocalTime.of(9, 0),
				LocalTime.of(18, 0),
				null,
				null,
				480,
				60,
				60L,
				0,
				0,
				List.of(
						new ScheduledBlock(
								BlockKind.WORK,
								LocalTime.of(9, 0),
								LocalTime.of(10, 0),
								1L,
								null,
								1,
								1)),
				List.of(new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, 30)));
	}

	private Task createTask(Long id, String title, Integer estimatedMinutes, TaskStatus status) {
		Task task = new Task();
		task.setTitle(title);
		task.setEstimatedMinutes(estimatedMinutes);
		task.setStatus(status);
		task.setPriority(TaskPriority.MEDIUM);
		ReflectionTestUtils.setField(task, "id", id);
		return task;
	}
}
