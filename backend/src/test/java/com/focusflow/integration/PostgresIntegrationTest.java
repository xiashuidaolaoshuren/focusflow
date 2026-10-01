package com.focusflow.integration;

import static com.focusflow.testsupport.PersistenceFixtures.savedPlan;
import static com.focusflow.testsupport.PersistenceFixtures.savedTask;
import static com.focusflow.testsupport.PersistenceFixtures.savedUser;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.focusflow.ai.AiPlanItem;
import com.focusflow.plan.DailyPlan;
import com.focusflow.plan.DailyPlanPersister;
import com.focusflow.plan.DailyPlanSchedule;
import com.focusflow.plan.DailyPlanTask;
import com.focusflow.plan.DailyPlanRepository;
import com.focusflow.plan.DailyPlanSummaryProjection;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.schedule.ScheduledBlock;
import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskRepository;
import com.focusflow.task.TaskStatus;
import com.focusflow.testsupport.DailyPlanTestBuilder;
import com.focusflow.testsupport.PostgresTestcontainerConfig;
import com.focusflow.testsupport.TaskTestBuilder;
import com.focusflow.testsupport.UserTestBuilder;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;

@SpringBootTest
@ActiveProfiles("test")
@Import(PostgresTestcontainerConfig.class)
class PostgresIntegrationTest {

	@Autowired UserRepository userRepository;

	@Autowired TaskRepository taskRepository;

	@Autowired DailyPlanRepository dailyPlanRepository;

	@Autowired DailyPlanPersister dailyPlanPersister;

	@Autowired TransactionTemplate transactionTemplate;

	@Autowired JdbcTemplate jdbcTemplate;

	@Test
	void v2Migration_createsSchedulingFoundationTables() {
		assertThat(tableExists("scheduling_preferences")).isTrue();
		assertThat(tableExists("fixed_breaks")).isTrue();
		assertThat(tableExists("commitments")).isTrue();
	}

	@Test
	void schedulingPreferences_rejectsDuplicateOwner() {
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(UUID.randomUUID().toString().substring(0, 8))
								.withAccountPrefix("prefs-owner")
								.withPasswordHash(
										"$2a$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"));

		insertSchedulingPreferences(owner.getId());
		assertThatThrownBy(() -> insertSchedulingPreferences(owner.getId()))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private void insertSchedulingPreferences(Long ownerId) {
		jdbcTemplate.update(
				"""
				INSERT INTO scheduling_preferences (
				    owner_id, work_day_start, work_day_end, cadence_enabled,
				    target_focus_minutes, break_minutes, min_session_minutes, buffer_minutes
				) VALUES (?, TIME '09:00', TIME '18:00', TRUE, 50, 10, 15, 0)
				""",
				ownerId);
	}

	@Test
	void fixedBreaks_rejectsOrphanSchedulingPreferencesReference() {
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO fixed_breaks (
										    scheduling_preferences_id, label, start_time, end_time
										) VALUES (999999, 'Lunch', TIME '12:00', TIME '13:00')
										"""))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void commitments_rejectsOrphanOwnerReference() {
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO commitments (
										    owner_id, title, commitment_date, start_time, end_time
										) VALUES (999999, 'Standup', DATE '2026-09-22', TIME '10:00', TIME '10:30')
										"""))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void tasks_rejectNonPositiveEstimatedMinutes() {
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(UUID.randomUUID().toString().substring(0, 8))
								.withAccountPrefix("estimate-owner")
								.withPasswordHash(
										"$2a$10$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"));

		assertThatThrownBy(() -> insertTaskWithEstimatedMinutes(owner.getId(), 0))
				.isInstanceOf(DataIntegrityViolationException.class);
		assertThatThrownBy(() -> insertTaskWithEstimatedMinutes(owner.getId(), -5))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private void insertTaskWithEstimatedMinutes(Long ownerId, int estimatedMinutes) {
		jdbcTemplate.update(
				"""
				INSERT INTO tasks (
				    owner_id, title, priority, status, estimated_minutes
				) VALUES (?, 'Bad estimate', 'MEDIUM', 'OPEN', ?)
				""",
				ownerId,
				estimatedMinutes);
	}

	private Long insertBareDailyPlan(String accountPrefix, int suffixNumber) {
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique("c" + suffixNumber)
								.withAccountPrefix(accountPrefix)
								.withPasswordHash(
										"$2a$10$8888888888888888888888888888888888888888888888888888"));
		return jdbcTemplate.queryForObject(
				"""
				INSERT INTO daily_plans (
				    owner_id, plan_date, created_at, window_start, window_end,
				    free_minutes, scheduled_work_minutes, required_minutes,
				    requested_buffer_minutes, realized_buffer_minutes
				) VALUES (?, DATE '2026-10-04', NOW(), TIME '09:00', TIME '18:00', 0, 0, 0, 0, 0)
				RETURNING id
				""",
				Long.class,
				owner.getId());
	}

	private Long insertBareDailyPlanTask(Long planId, long sourceTaskId) {
		return jdbcTemplate.queryForObject(
				"""
				INSERT INTO daily_plan_tasks (
				    daily_plan_id, rank, source_task_id, task_title, task_priority,
				    task_status, must_include
				) VALUES (?, 1, ?, 'Snapshot', 'MEDIUM', 'OPEN', FALSE)
				RETURNING id
				""",
				Long.class,
				planId,
				sourceTaskId);
	}

	@Test
	void dailyPlanBlocks_rejectZeroDurationIntervals() {
		Long planId = insertBareDailyPlan("block-zero-duration", 1);
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO daily_plan_blocks (
										    daily_plan_id, kind, start_time, end_time, label, position
										) VALUES (?, 'BUFFER', TIME '12:00', TIME '12:00', 'Buffer', 1)
										""",
										planId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void dailyPlanBlocks_rejectWorkBlockWithoutTaskReference() {
		Long planId = insertBareDailyPlan("block-work-no-ref", 2);
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO daily_plan_blocks (
										    daily_plan_id, kind, start_time, end_time, label, position
										) VALUES (?, 'WORK', TIME '09:00', TIME '10:00', NULL, 1)
										""",
										planId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void dailyPlanBlocks_rejectWorkBlockCarryingLabel() {
		Long planId = insertBareDailyPlan("block-work-label", 3);
		Long planTaskId = insertBareDailyPlanTask(planId, 999L);
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO daily_plan_blocks (
										    daily_plan_id, daily_plan_task_id, kind, start_time, end_time, label, position
										) VALUES (?, ?, 'WORK', TIME '09:00', TIME '10:00', 'Should not label work', 1)
										""",
										planId,
										planTaskId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void dailyPlanBlocks_rejectNonWorkBlockWithoutLabel() {
		Long planId = insertBareDailyPlan("block-nonwork-no-label", 4);
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO daily_plan_blocks (
										    daily_plan_id, kind, start_time, end_time, label, position
										) VALUES (?, 'BUFFER', TIME '17:00', TIME '18:00', NULL, 1)
										""",
										planId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void dailyPlanBlocks_rejectNonWorkBlockCarryingTaskReference() {
		Long planId = insertBareDailyPlan("block-nonwork-ref", 5);
		Long planTaskId = insertBareDailyPlanTask(planId, 999L);
		assertThatThrownBy(
						() ->
								jdbcTemplate.update(
										"""
										INSERT INTO daily_plan_blocks (
										    daily_plan_id, daily_plan_task_id, kind, start_time, end_time, label, position
										) VALUES (?, ?, 'BUFFER', TIME '17:00', TIME '18:00', 'Buffer', 1)
										""",
										planId,
										planTaskId))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	private boolean tableExists(String tableName) {
		Integer count =
				jdbcTemplate.queryForObject(
						"""
						SELECT COUNT(*)
						FROM information_schema.tables
						WHERE table_schema = 'public'
						  AND table_name = ?
						""",
						Integer.class,
						tableName);
		return count != null && count == 1;
	}

	@Test
	void persistsUser_andFindsByEmail() {
		User user =
				UserTestBuilder.user()
						.withAccountPrefix("alice")
						.withPasswordHash("$2a$10$hashedPlaceholderForBcryptLater")
						.build();

		User saved = userRepository.save(user);

		assertThat(saved.getId()).isNotNull();
		assertThat(userRepository.findByEmail(user.getEmail()))
				.isPresent()
				.get()
				.satisfies(found -> {
					assertThat(found.getId()).isEqualTo(saved.getId());
					assertThat(found.getUsername()).isEqualTo(user.getUsername());
					assertThat(found.getPasswordHash()).isEqualTo(user.getPasswordHash());
				});
	}

	@Test
	void duplicateEmailViolatesUniqueness() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		String email = "dup-" + suffix + "@example.com";

		User first =
				UserTestBuilder.user()
						.withUnique(suffix)
						.withEmail(email)
						.withUsername("user-a-" + suffix)
						.withPasswordHash("$2a$10$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
						.build();
		userRepository.saveAndFlush(first);

		User second =
				UserTestBuilder.user()
						.withEmail(email)
						.withUsername("user-b-" + suffix)
						.withPasswordHash("$2a$10$bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
						.build();

		assertThatThrownBy(() -> userRepository.saveAndFlush(second))
				.isInstanceOf(DataIntegrityViolationException.class);
	}

	@Test
	void persistsTask_andFindsByOwnerAndId() {
		User savedOwner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withAccountPrefix("owner-task")
								.withPasswordHash("$2a$10$ccccccccccccccccccccccccccccccccccccccccccccccccccccccc"));

		Task saved =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(savedOwner)
								.withTitle("Write integration tests")
								.withDescription("Cover owner-scoped persistence")
								.withPriority(TaskPriority.HIGH)
								.withStatus(TaskStatus.OPEN)
								.withDueDate(LocalDate.of(2026, 6, 1))
								.withEstimatedMinutes(45));

		assertThat(saved.getId()).isNotNull();
		assertThat(taskRepository.findByOwner_IdAndId(savedOwner.getId(), saved.getId()))
				.isPresent()
				.get()
				.satisfies(found -> {
					assertThat(found.getTitle()).isEqualTo("Write integration tests");
					assertThat(found.getOwner().getId()).isEqualTo(savedOwner.getId());
					assertThat(found.getPriority()).isEqualTo(TaskPriority.HIGH);
					assertThat(found.getStatus()).isEqualTo(TaskStatus.OPEN);
				});
	}

	@Test
	void taskQueriesAreOwnerScoped_forStatusAndDueDate() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);

		User ownerA =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("owner-a")
								.withPasswordHash("$2a$10$ddddddddddddddddddddddddddddddddddddddddddddddddddddddd"));

		User ownerB =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("owner-b")
								.withPasswordHash("$2a$10$eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"));

		Task taskLater =
				TaskTestBuilder.task(ownerA)
						.withTitle("Later")
						.withPriority(TaskPriority.MEDIUM)
						.withStatus(TaskStatus.OPEN)
						.withDueDate(LocalDate.of(2026, 6, 10))
						.build();

		Task taskSooner =
				TaskTestBuilder.task(ownerA)
						.withTitle("Sooner")
						.withPriority(TaskPriority.LOW)
						.withStatus(TaskStatus.OPEN)
						.withDueDate(LocalDate.of(2026, 6, 5))
						.build();

		Task taskB =
				TaskTestBuilder.task(ownerB)
						.withTitle("Other user")
						.withPriority(TaskPriority.HIGH)
						.withStatus(TaskStatus.OPEN)
						.withDueDate(LocalDate.of(2026, 6, 1))
						.build();

		taskLater = taskRepository.save(taskLater);
		taskRepository.save(taskSooner);
		taskRepository.save(taskB);
		taskRepository.flush();

		assertThat(taskRepository.findByOwner_IdAndId(ownerB.getId(), taskLater.getId())).isEmpty();

		assertThat(taskRepository.findByOwner_IdAndStatusOrderByDueDateAsc(ownerA.getId(), TaskStatus.OPEN))
				.extracting(Task::getTitle)
				.containsExactly("Sooner", "Later");

		assertThat(taskRepository.findByOwner_IdAndDueDateBetween(
						ownerB.getId(), LocalDate.of(2026, 5, 1), LocalDate.of(2026, 6, 30)))
				.singleElement()
				.satisfies(t -> assertThat(t.getTitle()).isEqualTo("Other user"));
	}

	@Test
	void dailyPlans_uniquePerOwnerAndDate_summaryOrdersByCreatedAtDesc() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("plan-owner")
								.withPasswordHash("$2a$10$fffffffffffffffffffffffffffffffffffffffffffffffffffffff"));

		LocalDate planDate = LocalDate.of(2026, 8, 15);

		DailyPlan savedEarlier =
				dailyPlanRepository.save(
						DailyPlanTestBuilder.plan(owner, planDate)
								.withCreatedAt(Instant.parse("2026-08-15T08:00:00Z"))
								.build());

		DailyPlan savedLater =
				dailyPlanRepository.save(
						DailyPlanTestBuilder.plan(owner, LocalDate.of(2026, 8, 16))
								.withCreatedAt(Instant.parse("2026-08-15T14:00:00Z"))
								.build());
		dailyPlanRepository.flush();

		assertThatThrownBy(
						() -> {
							dailyPlanRepository.save(
									DailyPlanTestBuilder.plan(owner, planDate)
											.withCreatedAt(Instant.parse("2026-08-15T20:00:00Z"))
											.build());
							dailyPlanRepository.flush();
						})
				.isInstanceOf(DataIntegrityViolationException.class);

		assertThat(
						dailyPlanRepository
								.findSummariesByOwner(owner.getId(), PageRequest.of(0, 20))
								.getContent())
				.extracting(DailyPlanSummaryProjection::getId)
				.containsExactly(savedLater.getId(), savedEarlier.getId());

		assertThat(
						dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
								owner.getId(), planDate))
				.isPresent()
				.get()
				.extracting(DailyPlan::getId)
				.isEqualTo(savedEarlier.getId());

		assertThat(dailyPlanRepository.findByOwner_IdAndId(owner.getId(), savedEarlier.getId()))
				.isPresent()
				.get()
				.satisfies(p -> assertThat(p.getPlanDate()).isEqualTo(planDate));
	}

	@Test
	void dailyPlanQueriesAreOwnerScoped_itemsPreserveTaskFkAndOrder() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);

		User ownerA =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("plan-a")
								.withPasswordHash("$2a$10$1111111111111111111111111111111111111111111111111111111"));

		User ownerB =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("plan-b")
								.withPasswordHash("$2a$10$2222222222222222222222222222222222222222222222222222222"));

		final Task savedFirst =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(ownerA)
								.withTitle("First task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		final Task savedSecond =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(ownerA)
								.withTitle("Second task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		DailyPlan plan =
				savedPlan(
						dailyPlanRepository,
						DailyPlanTestBuilder.plan(ownerA, LocalDate.of(2026, 9, 20))
								.withCreatedAt(Instant.parse("2026-09-20T11:00:00Z"))
								.addTask(savedSecond, 1, false, null, null)
								.addTask(savedFirst, 2, false, null, null));
		dailyPlanRepository.flush();

		assertThat(dailyPlanRepository.findByOwner_IdAndId(ownerB.getId(), plan.getId())).isEmpty();

		assertThat(dailyPlanRepository.findByOwner_IdAndId(ownerA.getId(), plan.getId()))
				.isPresent()
				.get()
				.satisfies(
						p -> {
							assertThat(p.getTasks())
									.extracting(DailyPlanTask::getRank)
									.containsExactly(1, 2);
							assertThat(p.getTasks())
									.extracting(DailyPlanTask::getSourceTaskId)
									.containsExactly(savedSecond.getId(), savedFirst.getId());
							assertThat(p.getTasks())
									.extracting(DailyPlanTask::getTaskTitle)
									.containsExactly("Second task", "First task");
						});
	}

	@Test
	void listDailyPlans_returnsSummariesWithoutLoadingItems() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("list-plan-owner")
								.withPasswordHash(
										"$2a$10$3333333333333333333333333333333333333333333333333333333"));

		Task savedFirst =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("First task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		Task savedSecond =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("Second task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		LocalDate planDate = LocalDate.of(2026, 9, 21);
		DailyPlan plan =
				savedPlan(
						dailyPlanRepository,
						DailyPlanTestBuilder.plan(owner, planDate)
								.withCreatedAt(Instant.parse("2026-09-21T10:00:00Z"))
								.withMetrics(480, 120, 90L, 0, 0)
								.addTask(savedSecond, 1, false, null, null)
								.addTask(savedFirst, 2, false, null, null)
								.addBlock(0, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), null, 1)
								.addBlock(1, BlockKind.WORK, LocalTime.of(10, 0), LocalTime.of(11, 0), null, 2));
		dailyPlanRepository.flush();

		List<DailyPlanSummaryProjection> summaries =
				dailyPlanRepository
						.findSummariesByOwner(owner.getId(), PageRequest.of(0, 20))
						.getContent();
		assertThat(summaries)
				.hasSize(1)
				.singleElement()
				.satisfies(
						summary -> {
							assertThat(summary.getId()).isEqualTo(plan.getId());
							assertThat(summary.getScheduledTaskCount()).isEqualTo(2);
							assertThat(summary.getHasWarning()).isFalse();
						});

		assertThat(dailyPlanRepository.findByOwner_IdAndId(owner.getId(), plan.getId()))
				.isPresent()
				.get()
				.satisfies(
						p -> {
							assertThat(p.getTasks())
									.extracting(DailyPlanTask::getRank)
									.containsExactly(1, 2);
							assertThat(p.getTasks())
									.extracting(DailyPlanTask::getTaskTitle)
									.containsExactly("Second task", "First task");
						});
	}

	@Test
	void deleteDailyPlan_removesItemsAndLeavesTasks() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("delete-plan-owner")
								.withPasswordHash(
										"$2a$10$4444444444444444444444444444444444444444444444444444444"));

		Task savedFirst =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("First task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		Task savedSecond =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("Second task")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN));

		DailyPlan plan =
				savedPlan(
						dailyPlanRepository,
						DailyPlanTestBuilder.plan(owner, LocalDate.of(2026, 9, 22))
								.withCreatedAt(Instant.parse("2026-09-22T10:00:00Z"))
								.addTask(savedFirst, 1, false, null, null)
								.addTask(savedSecond, 2, false, null, null));
		Long planId = plan.getId();
		dailyPlanRepository.flush();

		dailyPlanRepository.delete(plan);
		dailyPlanRepository.flush();

		assertThat(dailyPlanRepository.findByOwner_IdAndId(owner.getId(), planId)).isEmpty();
		assertThat(
						dailyPlanRepository
								.findSummariesByOwner(owner.getId(), PageRequest.of(0, 20))
								.getContent())
				.isEmpty();
		assertThat(taskRepository.findByOwner_IdOrderByDueDateAsc(owner.getId()))
				.extracting(Task::getId)
				.containsExactly(savedFirst.getId(), savedSecond.getId());
	}

	@Test
	void persistedDailyPlan_roundTripsScheduleMetrics() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("metrics-plan-owner")
								.withPasswordHash(
										"$2a$10$5555555555555555555555555555555555555555555555555555555"));

		DailyPlan savedWithMetrics =
				savedPlan(
						dailyPlanRepository,
						DailyPlanTestBuilder.plan(owner, LocalDate.of(2026, 10, 1))
								.withCreatedAt(Instant.parse("2026-10-01T10:00:00Z"))
								.withMetrics(420, 180, 240L, 15, 10));
		dailyPlanRepository.flush();

		assertThat(dailyPlanRepository.findByOwner_IdAndId(owner.getId(), savedWithMetrics.getId()))
				.isPresent()
				.get()
				.satisfies(
						reloaded -> {
							assertThat(reloaded.getFreeMinutes()).isEqualTo(420);
							assertThat(reloaded.getScheduledWorkMinutes()).isEqualTo(180);
							assertThat(reloaded.getRequiredMinutes()).isEqualTo(240L);
							assertThat(reloaded.getRequestedBufferMinutes()).isEqualTo(15);
assertThat(reloaded.getRealizedBufferMinutes()).isEqualTo(10);
					});
	}

	@Test
	@WithMockUser(username = "sched-replace-owner")
	void replacingDailyPlan_deletesOldRowBeforeInsertingNewOne() {
		User owner =
				userRepository
						.findByUsername("sched-replace-owner")
						.orElseGet(
								() ->
										userRepository.save(
												UserTestBuilder.user()
														.withUsername("sched-replace-owner")
														.withEmail("sched-replace-owner@example.com")
														.withPasswordHash(
																"$2a$10$6666666666666666666666666666666666666666666666666666")
														.build()));

		Task task =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("Replace work")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.IN_PROGRESS)
								.withEstimatedMinutes(60));

		LocalDate planDate = LocalDate.of(2026, 10, 2);
		DailyPlan existing =
				dailyPlanRepository.save(
						DailyPlanTestBuilder.plan(owner, planDate)
								.withCreatedAt(Instant.parse("2026-10-02T08:00:00Z"))
								.build());
		Long existingId = existing.getId();

		List<AiPlanItem> aiItems = List.of(new AiPlanItem(task.getId(), 1));
		DailyPlanSchedule schedule =
				new DailyPlanSchedule(
						LocalTime.of(9, 0),
						LocalTime.of(18, 0),
						null,
						null,
						540,
						60,
						60L,
						0,
						0,
						List.of(
								new ScheduledBlock(
										BlockKind.WORK,
										LocalTime.of(9, 0),
										LocalTime.of(10, 0),
										task.getId(),
										null)),
						List.of());

		DailyPlanResponse response =
				transactionTemplate.execute(
						status ->
								dailyPlanPersister.persistPlan(
										owner.getId(), planDate, existingId, aiItems, List.of(task), schedule));

		assertThat(response.id()).isNotEqualTo(existingId);
		assertThat(dailyPlanRepository.findByOwner_IdAndId(owner.getId(), existingId)).isEmpty();
		assertThat(
						dailyPlanRepository.findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
								owner.getId(), planDate))
				.isPresent()
				.get()
				.satisfies(current -> assertThat(current.getId()).isEqualTo(response.id()));
	}

	@Test
	void dailyPlans_summaryScheduledTaskCount_countsOnlyPlacedTasks() {
		String suffix = UUID.randomUUID().toString().substring(0, 8);
		User owner =
				savedUser(
						userRepository,
						UserTestBuilder.user()
								.withUnique(suffix)
								.withAccountPrefix("count-plan-owner")
								.withPasswordHash(
										"$2a$10$7777777777777777777777777777777777777777777777777777"));

		Task placed =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("Placed")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.IN_PROGRESS)
								.withEstimatedMinutes(90));

		Task unplaced =
				savedTask(
						taskRepository,
						TaskTestBuilder.task(owner)
								.withTitle("Unplaced")
								.withPriority(TaskPriority.MEDIUM)
								.withStatus(TaskStatus.OPEN)
								.withEstimatedMinutes(45));

		savedPlan(
				dailyPlanRepository,
				DailyPlanTestBuilder.plan(owner, LocalDate.of(2026, 10, 3))
						.withCreatedAt(Instant.parse("2026-10-03T08:00:00Z"))
						.withMetrics(480, 60, 135L, 0, 0)
						.addTask(placed, 1, true, UnplacedReason.OUT_OF_TIME, 30)
						.addTask(unplaced, 2, false, UnplacedReason.OUT_OF_TIME, 45)
						.addBlock(0, BlockKind.WORK, LocalTime.of(9, 0), LocalTime.of(10, 0), null, 1));
		dailyPlanRepository.flush();

		assertThat(
						dailyPlanRepository
								.findSummariesByOwner(owner.getId(), PageRequest.of(0, 20))
								.getContent())
				.singleElement()
				.satisfies(
						summary -> {
							assertThat(summary.getScheduledTaskCount()).isEqualTo(1);
							assertThat(summary.getWorkSessionCount()).isEqualTo(1);
							assertThat(summary.getUnplacedWorkCount()).isEqualTo(2);
						});
	}
}
