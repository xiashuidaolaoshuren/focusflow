package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.dependency.DependencyLink;
import com.focusflow.task.dto.TaskLinkResponse;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.testsupport.DailyPlanAiTestConfiguration;
import com.focusflow.testsupport.PostgresTestcontainerConfig;
import com.focusflow.testsupport.TaskTestBuilder;
import com.focusflow.testsupport.UserTestBuilder;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class TaskDependencyServiceTest {

	private static final Long OWNER_ID = 42L;

	@Mock
	private OwnerSchedulingLock ownerSchedulingLock;

	@Mock
	private TaskRepository taskRepository;

	@Mock
	private TaskDependencyRepository taskDependencyRepository;

	@Mock
	private TaskQueryService taskQueryService;

	@Mock
	private TaskResponseMapper taskResponseMapper;

	private TaskDependencyService taskDependencyService;

	private User owner;

	@BeforeEach
	void setUp() {
		taskDependencyService =
				new TaskDependencyService(
						ownerSchedulingLock,
						taskRepository,
						taskDependencyRepository,
						taskQueryService,
						taskResponseMapper);
		owner = new User();
		ReflectionTestUtils.setField(owner, "id", OWNER_ID);
	}

	@Test
	void addBlocker_whenBlockedTaskMissing_throwsNotFoundAndStoresNothing() {
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 1L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> taskDependencyService.addBlocker(1L, 2L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");

		verify(taskDependencyRepository, never()).save(any());
	}

	@Test
	void addBlocker_whenBlockerTaskMissing_throwsNotFoundAndStoresNothing() {
		Task blocked = taskWithId(1L);
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 1L)).thenReturn(Optional.of(blocked));
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 2L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> taskDependencyService.addBlocker(1L, 2L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("task not found");

		verify(taskDependencyRepository, never()).save(any());
	}

	@Test
	void addBlocker_whenBlockerIsSameTask_throwsSelfDependencyAndStoresNothing() {
		Task task = taskWithId(1L);
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 1L)).thenReturn(Optional.of(task));

		assertThatThrownBy(() -> taskDependencyService.addBlocker(1L, 1L))
				.isInstanceOf(BadRequestException.class)
				.satisfies(
						ex ->
								assertThat(((BadRequestException) ex).getCode())
										.isEqualTo("SELF_DEPENDENCY"));

		verify(taskDependencyRepository, never()).save(any());
	}

	@Test
	void addBlocker_whenPairExists_throwsDependencyExistsAndStoresNothing() {
		Task blocked = taskWithId(1L);
		Task blocker = taskWithId(2L);
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 1L)).thenReturn(Optional.of(blocked));
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 2L)).thenReturn(Optional.of(blocker));
		when(taskDependencyRepository.existsByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
						OWNER_ID, 1L, 2L))
				.thenReturn(true);

		assertThatThrownBy(() -> taskDependencyService.addBlocker(1L, 2L))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("DEPENDENCY_EXISTS"));

		verify(taskDependencyRepository, never()).save(any());
	}

	@Test
	void addBlocker_whenWouldCycleThroughDoneBlocker_throwsDependencyCycleAndStoresNothing() {
		Task blocked = taskWithId(10L);
		Task blocker = taskWithId(20L);
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 10L)).thenReturn(Optional.of(blocked));
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 20L)).thenReturn(Optional.of(blocker));
		when(taskDependencyRepository.existsByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
						OWNER_ID, 10L, 20L))
				.thenReturn(false);
		when(taskQueryService.findLinksByOwnerId(OWNER_ID))
				.thenReturn(
						List.of(
								new DependencyLink(30L, 20L, false),
								new DependencyLink(10L, 30L, true)));

		assertThatThrownBy(() -> taskDependencyService.addBlocker(10L, 20L))
				.isInstanceOf(ConflictException.class)
				.satisfies(
						ex ->
								assertThat(((ConflictException) ex).getCode())
										.isEqualTo("DEPENDENCY_CYCLE"));

		verify(taskDependencyRepository, never()).save(any());

		InOrder order = inOrder(ownerSchedulingLock, taskQueryService);
		order.verify(ownerSchedulingLock).lockCurrentOwner();
		order.verify(taskQueryService).findLinksByOwnerId(OWNER_ID);
	}

	@Test
	void addBlocker_whenValid_storesRowAndReturnsTaskResponse() {
		Task blocked = taskWithId(1L);
		blocked.setOwner(owner);
		Task blocker = taskWithId(2L);
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 1L)).thenReturn(Optional.of(blocked));
		when(taskRepository.findByOwner_IdAndId(OWNER_ID, 2L)).thenReturn(Optional.of(blocker));
		when(taskDependencyRepository.existsByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
						OWNER_ID, 1L, 2L))
				.thenReturn(false);
		when(taskQueryService.findLinksByOwnerId(OWNER_ID)).thenReturn(List.of());

		TaskResponse mapped =
				new TaskResponse(
						1L,
						"Blocked",
						null,
						TaskPriority.MEDIUM,
						TaskStatus.OPEN,
						null,
						null,
						null,
						0,
						List.of(new TaskLinkResponse(2L, "Blocker", TaskStatus.OPEN)),
						List.of());
		when(taskResponseMapper.toResponse(blocked)).thenReturn(mapped);

		TaskResponse result = taskDependencyService.addBlocker(1L, 2L);

		assertThat(result).isSameAs(mapped);

		ArgumentCaptor<TaskDependency> captor = ArgumentCaptor.forClass(TaskDependency.class);
		verify(taskDependencyRepository).save(captor.capture());
		TaskDependency saved = captor.getValue();
		assertThat(saved.getOwner()).isSameAs(owner);
		assertThat(saved.getBlockedTaskId()).isEqualTo(1L);
		assertThat(saved.getBlockerTaskId()).isEqualTo(2L);

		verify(taskRepository, never()).save(any());

		InOrder order =
				inOrder(
						ownerSchedulingLock,
						taskRepository,
						taskDependencyRepository,
						taskResponseMapper);
		order.verify(ownerSchedulingLock).lockCurrentOwner();
		order.verify(taskRepository).findByOwner_IdAndId(OWNER_ID, 1L);
		order.verify(taskRepository).findByOwner_IdAndId(OWNER_ID, 2L);
		order.verify(taskDependencyRepository).save(any(TaskDependency.class));
	}

	@Test
	void addBlocker_isTransactional() throws Exception {
		Method method =
				TaskDependencyService.class.getMethod("addBlocker", long.class, long.class);
		assertThat(method.isAnnotationPresent(Transactional.class)).isTrue();
	}

	@Test
	void removeBlocker_isTransactional() throws Exception {
		Method method =
				TaskDependencyService.class.getMethod("removeBlocker", long.class, long.class);
		assertThat(method.isAnnotationPresent(Transactional.class)).isTrue();
	}

	@Test
	void removeBlocker_whenMissing_throwsNotFoundAndDoesNotDelete() {
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskDependencyRepository.findByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
						OWNER_ID, 1L, 2L))
				.thenReturn(Optional.empty());

		assertThatThrownBy(() -> taskDependencyService.removeBlocker(1L, 2L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("dependency not found");

		verify(taskDependencyRepository, never()).delete(any());
	}

	@Test
	void removeBlocker_whenPresent_deletesUnderLock() {
		TaskDependency stored = new TaskDependency();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(taskDependencyRepository.findByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
						OWNER_ID, 1L, 2L))
				.thenReturn(Optional.of(stored));

		taskDependencyService.removeBlocker(1L, 2L);

		verify(taskDependencyRepository).delete(stored);
		verify(ownerSchedulingLock).lockCurrentOwner();
	}

	private static Task taskWithId(long id) {
		Task task = new Task();
		ReflectionTestUtils.setField(task, "id", id);
		task.setTitle("Task " + id);
		task.setPriority(TaskPriority.MEDIUM);
		task.setStatus(TaskStatus.OPEN);
		task.setEffortVersion(0);
		return task;
	}

	@Nested
	@SpringBootTest
	@ActiveProfiles("test")
	@Import({DailyPlanAiTestConfiguration.class, PostgresTestcontainerConfig.class})
	class ConcurrentCycleIntegration {

		private static final String RACE_OWNER_USERNAME = "dep-race-owner";

		@Autowired
		TaskDependencyService taskDependencyService;

		@Autowired
		UserRepository userRepository;

		@Autowired
		TaskRepository taskRepository;

		@Autowired
		TaskDependencyRepository taskDependencyRepository;

		@Autowired
		TransactionTemplate transactionTemplate;

		private Long taskAId;
		private Long taskBId;

		@BeforeEach
		void seedOwnerAndTasks() {
			User owner =
					userRepository
							.findByUsername(RACE_OWNER_USERNAME)
							.orElseGet(
									() ->
											userRepository.save(
													UserTestBuilder.user()
															.withUsername(RACE_OWNER_USERNAME)
															.withEmail(
																	"dep-race-owner@example.com")
															.withPasswordHash(
																	"$2a$10$cccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
															.build()));
			taskDependencyRepository.deleteAll(
					taskDependencyRepository.findByOwner_Id(owner.getId()));
			List<Task> existing =
					taskRepository.findByOwner_IdOrderByDueDateAsc(owner.getId());
			for (Task task : existing) {
				taskRepository.delete(task);
			}
			transactionTemplate.executeWithoutResult(
					status -> {
						Task a =
								taskRepository.save(
										TaskTestBuilder.task(owner).withTitle("A").build());
						Task b =
								taskRepository.save(
										TaskTestBuilder.task(owner).withTitle("B").build());
						taskAId = a.getId();
						taskBId = b.getId();
					});
		}

		@Test
		@WithMockUser(username = RACE_OWNER_USERNAME)
		void concurrentAddsFormingCycle_yieldOneSuccessAndOneConflict() throws Exception {
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			CountDownLatch start = new CountDownLatch(1);
			AtomicReference<Throwable> firstError = new AtomicReference<>();
			AtomicReference<Throwable> secondError = new AtomicReference<>();
			java.util.concurrent.atomic.AtomicInteger successCount =
					new java.util.concurrent.atomic.AtomicInteger();

			Thread thread1 =
					new Thread(
							() ->
									runWithAuthentication(
											authentication,
											() ->
													transactionTemplate.executeWithoutResult(
															status -> {
																try {
																	start.await(5, TimeUnit.SECONDS);
																	taskDependencyService.addBlocker(
																			taskAId, taskBId);
																	successCount.incrementAndGet();
																} catch (Exception ex) {
																	firstError.set(ex);
																}
															})));

			Thread thread2 =
					new Thread(
							() ->
									runWithAuthentication(
											authentication,
											() ->
													transactionTemplate.executeWithoutResult(
															status -> {
																try {
																	start.await(5, TimeUnit.SECONDS);
																	taskDependencyService.addBlocker(
																			taskBId, taskAId);
																	successCount.incrementAndGet();
																} catch (Exception ex) {
																	secondError.set(ex);
																}
															})));

			thread1.start();
			thread2.start();
			start.countDown();
			thread1.join(10_000);
			thread2.join(10_000);

			int successes = successCount.get();
			int cycleConflicts =
					(isCycleConflict(firstError.get()) ? 1 : 0)
							+ (isCycleConflict(secondError.get()) ? 1 : 0);

			assertThat(successes + cycleConflicts).isEqualTo(2);
			assertThat(successes).isEqualTo(1);
			assertThat(cycleConflicts).isEqualTo(1);

			User owner = userRepository.findByUsername(RACE_OWNER_USERNAME).orElseThrow();
			assertThat(taskDependencyRepository.findByOwner_Id(owner.getId())).hasSize(1);
		}

		private static boolean isCycleConflict(Throwable ex) {
			return ex instanceof ConflictException conflict
					&& "DEPENDENCY_CYCLE".equals(conflict.getCode());
		}

		private static void runWithAuthentication(Authentication authentication, Runnable action) {
			SecurityContext context = SecurityContextHolder.createEmptyContext();
			context.setAuthentication(authentication);
			SecurityContextHolder.setContext(context);
			try {
				action.run();
			} finally {
				SecurityContextHolder.clearContext();
			}
		}
	}
}
