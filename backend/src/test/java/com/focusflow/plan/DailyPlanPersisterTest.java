package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.dependency.InheritedAssignment;
import com.focusflow.dependency.RankingGroup;
import com.focusflow.common.error.ConflictException;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.plan.dto.TaskEffortVersion;
import com.focusflow.plan.DailyPlanRevision;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.FixedBreakWindow;
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
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
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
		responseMapper = new DailyPlanResponseMapper(taskQueryService);
		lenient()
				.when(taskQueryService.findUnplannedWorkByOwnerIdAndWorkDate(any(), any()))
				.thenReturn(List.of());
		lenient().when(taskQueryService.findLinksByOwnerId(any())).thenReturn(List.of());
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
						List.class,
						DailyPlanSchedule.class,
						PlanDependencyCapture.class);

		assertThat(method.isAnnotationPresent(Transactional.class)).isTrue();
	}

	@Test
	void persistPlan_writesRevisionOneWithScheduleMetrics() throws Exception {
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
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, null, aiItems, List.of(task), schedule, emptyCapture());

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).saveAndFlush(captor.capture());
		DailyPlan savedPlan = captor.getValue();

		Method getRevisions = DailyPlan.class.getMethod("getRevisions");
		@SuppressWarnings("unchecked")
		java.util.Set<Object> revisions = (java.util.Set<Object>) getRevisions.invoke(savedPlan);
		assertThat(revisions).hasSize(1);
		Object revision = revisions.iterator().next();
		assertThat(revision.getClass().getMethod("getRevisionNumber").invoke(revision))
				.isEqualTo(1);
		assertThat(revision.getClass().getMethod("getFreeMinutes").invoke(revision))
				.isEqualTo(480);
		assertThat(revision.getClass().getMethod("getScheduledWorkMinutes").invoke(revision))
				.isEqualTo(60);
		assertThat(revision.getClass().getMethod("getRequiredMinutes").invoke(revision))
				.isEqualTo(60L);
		assertThat(revision.getClass().getMethod("getTasks").invoke(revision))
				.asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.collection(Object.class))
				.hasSize(1);
		assertThat(revision.getClass().getMethod("getBlocks").invoke(revision))
				.asInstanceOf(org.assertj.core.api.InstanceOfAssertFactories.collection(Object.class))
				.hasSize(1);
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
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		DailyPlanResponse response =
				persister.persistPlan(
						1L,
						planDate,
						null,
						aiItems,
						List.of(task),
						schedule,
						captureMustContinue(task));

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).saveAndFlush(captor.capture());
		DailyPlan savedPlan = captor.getValue();
		assertThat(savedPlan.getOwner()).isSameAs(owner);
		assertThat(savedPlan.getPlanDate()).isEqualTo(planDate);
		assertThat(savedPlan.getWindowStart()).isEqualTo(LocalTime.of(9, 0));
		assertThat(savedPlan.getWindowEnd()).isEqualTo(LocalTime.of(18, 0));
		DailyPlanRevision revision = savedPlan.getLatestRevision();
		assertThat(revision.getFreeMinutes()).isEqualTo(480);
		assertThat(revision.getScheduledWorkMinutes()).isEqualTo(60);
		assertThat(revision.getRequiredMinutes()).isEqualTo(60L);
		assertThat(revision.getTasks()).hasSize(1);
		DailyPlanTask savedPlanTask = revision.getTasks().iterator().next();
		assertThat(savedPlanTask.getTaskReference()).isSameAs(task);
		assertThat(savedPlanTask.getRank()).isEqualTo(1);
		assertThat(savedPlanTask.isMustInclude()).isTrue();
		assertThat(savedPlanTask.getUnplacedReason())
				.isEqualTo(UnplacedReason.OUT_OF_TIME);
		assertThat(savedPlanTask.getUnplacedMinutes()).isEqualTo(30);
		assertThat(revision.getBlocks())
				.singleElement()
				.satisfies(
						block -> {
							assertThat(block.getKind()).isEqualTo(BlockKind.WORK);
							assertThat(block.getStartTime()).isEqualTo(LocalTime.of(9, 0));
							assertThat(block.getEndTime()).isEqualTo(LocalTime.of(10, 0));
							assertThat(block.getPosition()).isEqualTo(1);
							assertThat(block.getDailyPlanTask())
									.isSameAs(savedPlanTask);
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
										List.of(createTask(1L, "Captured", 60, TaskStatus.IN_PROGRESS)),
										sampleSchedule(),
										emptyCapture()))
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
										List.of(createTask(1L, "Captured", 60, TaskStatus.IN_PROGRESS)),
										sampleSchedule(),
										emptyCapture()))
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
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, 5L, aiItems, List.of(task), schedule, emptyCapture());

		verify(dailyPlanRepository).delete(existing);
		verify(dailyPlanRepository).save(any(DailyPlan.class));
		verify(dailyPlanRepository).saveAndFlush(any(DailyPlan.class));
	}

	@Test
	void persistPlan_onReplace_flushesDeleteBeforeSave() {
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlan(5L, planDate);
		Task task = createTask(1L, "Continue work", 60, TaskStatus.IN_PROGRESS);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(new User());
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.of(existing));
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(task));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, 5L, aiItems, List.of(task), sampleSchedule(), emptyCapture());

		InOrder inOrder = inOrder(dailyPlanRepository);
		inOrder.verify(dailyPlanRepository).delete(existing);
		inOrder.verify(dailyPlanRepository).flush();
		inOrder.verify(dailyPlanRepository).save(any(DailyPlan.class));
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
						() -> persister.persistPlan(
										1L,
										planDate,
										null,
										aiItems,
										List.of(createTask(1L, "Captured", 60, TaskStatus.IN_PROGRESS)),
										sampleSchedule(),
										emptyCapture()))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex -> {
							assertThat(((ConflictException) ex).getCode())
									.isEqualTo("TASK_MISSING_DURING_GENERATION");
							assertThat(ex).hasMessage("a selected task is no longer available");
						});
	}

	@Test
	void appendRevision_addsNextRevisionWithCutoffAndPreservesPlanIdentity() {
		User owner = new User();
		ReflectionTestUtils.setField(owner, "id", 1L);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlanWithRevision(5L, planDate, 100L, 1);
		existing.setWindowStart(LocalTime.of(9, 0));
		existing.setWindowEnd(LocalTime.of(18, 0));
		DailyPlanSchedule schedule =
				new DailyPlanSchedule(
						LocalTime.of(14, 0),
						LocalTime.of(18, 0),
						null,
						null,
						240,
						0,
						0L,
						0,
						0,
						List.of(),
						List.of(),
						true,
						50,
						10,
						15,
						0,
						List.of());

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findByOwner_IdAndId(1L, 5L)).thenReturn(Optional.of(existing));
		when(taskQueryService.findPlannableTasksByOwnerId(1L)).thenReturn(List.of());
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		DailyPlanResponse response =
				persister.appendRevision(
						5L,
						100L,
						List.of(),
						LocalTime.of(14, 0),
						List.of(),
						List.of(),
						schedule,
						emptyCapture());

		assertThat(existing.getRevisions()).hasSize(2);
		DailyPlanRevision latest = existing.getLatestRevision();
		assertThat(latest.getRevisionNumber()).isEqualTo(2);
		assertThat(latest.getCutoffTime()).isEqualTo(LocalTime.of(14, 0));
		assertThat(existing.getWindowStart()).isEqualTo(LocalTime.of(9, 0));
		assertThat(existing.getWindowEnd()).isEqualTo(LocalTime.of(18, 0));
		assertThat(response.id()).isEqualTo(5L);
	}

	@Test
	void appendRevision_whenExpectedRevisionIsStale_throwsPlanChanged() {
		User owner = new User();
		ReflectionTestUtils.setField(owner, "id", 1L);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		DailyPlan existing = existingPlanWithRevision(5L, planDate, 100L, 1);

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findByOwner_IdAndId(1L, 5L)).thenReturn(Optional.of(existing));
		when(taskQueryService.findPlannableTasksByOwnerId(1L)).thenReturn(List.of());

		assertThatThrownBy(
						() ->
								persister.appendRevision(
										5L,
										99L,
										List.of(),
										LocalTime.of(14, 0),
										List.of(),
										List.of(),
										sampleSchedule(),
										emptyCapture()))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode()).isEqualTo("PLAN_CHANGED"));

		verify(dailyPlanRepository, never()).saveAndFlush(any());
	}

	private DailyPlan existingPlan(long id, LocalDate planDate) {
		DailyPlan plan = new DailyPlan();
		ReflectionTestUtils.setField(plan, "id", id);
		plan.setPlanDate(planDate);
		return plan;
	}

	private DailyPlan existingPlanWithRevision(
			long planId, LocalDate planDate, long revisionId, int revisionNumber) {
		DailyPlan plan = existingPlan(planId, planDate);
		DailyPlanRevision revision = new DailyPlanRevision();
		revision.setRevisionNumber(revisionNumber);
		ReflectionTestUtils.setField(revision, "id", revisionId);
		plan.addRevision(revision);
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
								null)),
				List.of(new UnplacedWork(1L, UnplacedReason.OUT_OF_TIME, 30)),
				true,
				50,
				10,
				15,
				0,
				List.of());
	}

	@Test
	void persistPlan_usesCapturedTaskSnapshotEvenWhenReloadedTaskChanged() {
		User owner = new User();
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));
		DailyPlanSchedule schedule = sampleSchedule();

		Task captured =
				createTask(1L, "Captured title", 60, TaskStatus.OPEN, LocalDate.of(2026, 8, 28));
		Task reloaded =
				createTask(1L, "Edited after provider", 90, TaskStatus.IN_PROGRESS, LocalDate.of(2026, 9, 1));

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.empty());
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(reloaded));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(
				1L,
				planDate,
				null,
				aiItems,
				List.of(captured),
				schedule,
				captureWithGroup(captured, RankingGroup.DUE_OR_OVERDUE));

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		DailyPlanTask planTask = captor.getValue().getLatestRevision().getTasks().iterator().next();
		assertThat(planTask.getTaskTitle()).isEqualTo("Captured title");
		assertThat(planTask.getTaskEstimatedMinutes()).isEqualTo(60);
		assertThat(planTask.getTaskDueDate()).isEqualTo(LocalDate.of(2026, 8, 28));
		assertThat(planTask.getTaskStatus()).isEqualTo(TaskStatus.OPEN);
		assertThat(planTask.getTaskPriority()).isEqualTo(TaskPriority.MEDIUM);
		assertThat(planTask.isMustInclude()).isTrue();
		assertThat(planTask.getTaskReference()).isSameAs(reloaded);
	}

	@Test
	void persistPlan_storesTheCapturedRemainingEffortEvenWhenReloadedTaskChanged() {
		User owner = new User();
		LocalDate planDate = LocalDate.of(2026, 9, 1);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		Task captured = createTask(1L, "Captured", 90, TaskStatus.OPEN);
		captured.setRemainingEffortMinutes(40);
		Task reloaded = createTask(1L, "Reloaded later", 90, TaskStatus.OPEN);
		reloaded.setRemainingEffortMinutes(15);

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.empty());
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(reloaded));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, null, aiItems, List.of(captured), sampleSchedule(), emptyCapture());

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		DailyPlanTask planTask = captor.getValue().getLatestRevision().getTasks().iterator().next();
		assertThat(planTask.getCapturedRemainingEffortMinutes()).isEqualTo(40);
		assertThat(captured.getRemainingEffortMinutes()).isEqualTo(40);
		assertThat(reloaded.getRemainingEffortMinutes()).isEqualTo(15);
	}

	@Test
	void persistPlan_writesTheCapturedSchedulingPolicyAndFixedBreaks() {
		User owner = new User();
		LocalDate planDate = LocalDate.of(2026, 9, 2);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));
		Task captured = createTask(1L, "Captured", 60, TaskStatus.OPEN);

		DailyPlanSchedule schedule =
				new DailyPlanSchedule(
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
										null)),
						List.of(),
						false,
						45,
						7,
						20,
						12,
						List.of(
								new FixedBreakWindow(
										"Lunch", LocalTime.of(12, 0), LocalTime.of(13, 0))));

		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
						1L, planDate))
				.thenReturn(Optional.empty());
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(captured));
		when(dailyPlanRepository.save(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));
		when(dailyPlanRepository.saveAndFlush(any(DailyPlan.class)))
				.thenAnswer(invocation -> invocation.getArgument(0));

		persister.persistPlan(1L, planDate, null, aiItems, List.of(captured), schedule, emptyCapture());

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		DailyPlan plan = captor.getValue();
		assertThat(plan.getCadenceEnabled()).isFalse();
		assertThat(plan.getTargetFocusMinutes()).isEqualTo(45);
		assertThat(plan.getBreakMinutes()).isEqualTo(7);
		assertThat(plan.getMinSessionMinutes()).isEqualTo(20);
		assertThat(plan.getBufferMinutes()).isEqualTo(12);
		assertThat(plan.getFixedBreakSnapshots())
				.singleElement()
				.satisfies(
						snapshot -> {
							assertThat(snapshot.getLabel()).isEqualTo("Lunch");
							assertThat(snapshot.getStartTime()).isEqualTo(LocalTime.of(12, 0));
							assertThat(snapshot.getEndTime()).isEqualTo(LocalTime.of(13, 0));
						});
	}

	private Task createTask(Long id, String title, Integer estimatedMinutes, TaskStatus status) {
		return createTask(id, title, estimatedMinutes, status, null);
	}

	private Task createTask(
			Long id,
			String title,
			Integer estimatedMinutes,
			TaskStatus status,
			LocalDate dueDate) {
		Task task = new Task();
		task.setTitle(title);
		task.setEstimatedMinutes(estimatedMinutes);
		task.setStatus(status);
		task.setPriority(TaskPriority.MEDIUM);
		task.setDueDate(dueDate);
		ReflectionTestUtils.setField(task, "id", id);
		return task;
	}

	private static PlanDependencyCapture emptyCapture() {
		return new PlanDependencyCapture(List.of(), List.of(), Map.of());
	}

	private static PlanDependencyCapture captureMustContinue(Task task) {
		return captureWithGroup(task, RankingGroup.MUST_CONTINUE);
	}

	private static PlanDependencyCapture captureWithGroup(Task task, RankingGroup group) {
		long taskId = task.getId() != null ? task.getId() : 0L;
		return new PlanDependencyCapture(
				List.of(),
				List.of(new InheritedAssignment(taskId, group, task.getDueDate(), taskId)),
				Map.of());
	}
}
