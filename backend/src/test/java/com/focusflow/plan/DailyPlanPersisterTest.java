package com.focusflow.plan;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.ConflictException;
import com.focusflow.ai.AiPlanItem;
import com.focusflow.plan.dto.DailyPlanResponse;
import com.focusflow.task.Task;
import com.focusflow.task.TaskQueryService;
import com.focusflow.user.User;
import com.focusflow.user.UserRepository;
import java.lang.reflect.Method;
import java.time.LocalDate;
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
	private UserRepository userRepository;

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
						userRepository, taskQueryService, dailyPlanRepository, responseMapper);
	}

	@Test
	void persistPlan_isTransactional() throws Exception {
		Method method =
				DailyPlanPersister.class.getMethod(
						"persistPlan",
						Long.class,
						LocalDate.class,
						List.class,
						int.class);

		assertThat(method.isAnnotationPresent(Transactional.class)).isTrue();
	}

	@Test
	void persistPlan_persistsPlanAndReturnsResponse() {
		User owner = new User();
		Task task = createTask(1L, owner, "Continue work", 60);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(task));
		when(dailyPlanRepository.save(any(DailyPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

		DailyPlanResponse response =
				persister.persistPlan(1L, planDate, aiItems, 120);

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		DailyPlan savedPlan = captor.getValue();
		assertThat(savedPlan.getOwner()).isSameAs(owner);
		assertThat(savedPlan.getPlanDate()).isEqualTo(planDate);
		assertThat(savedPlan.getFreeMinutes()).isEqualTo(120);
		assertThat(savedPlan.getTasks()).hasSize(1);
		assertThat(savedPlan.getTasks().get(0).getTaskReference()).isSameAs(task);
		assertThat(savedPlan.getTasks().get(0).getRank()).isEqualTo(1);
		assertThat(response.planDate()).isEqualTo(planDate);
		assertThat(response.freeMinutes()).isEqualTo(120);
		assertThat(response.blocks()).isEmpty();
	}

	@Test
	void persistPlan_persistsAvailableMinutesAndNullWarning_whenSnapshotNull() {
		User owner = new User();
		Task task = createTask(1L, owner, "Continue work", 60);
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		when(userRepository.findById(1L)).thenReturn(Optional.of(owner));
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of(task));
		when(dailyPlanRepository.save(any(DailyPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

		DailyPlanResponse response = persister.persistPlan(1L, planDate, aiItems, 120);

		ArgumentCaptor<DailyPlan> captor = ArgumentCaptor.forClass(DailyPlan.class);
		verify(dailyPlanRepository).save(captor.capture());
		assertThat(captor.getValue().getFreeMinutes()).isEqualTo(120);
		assertThat(response.freeMinutes()).isEqualTo(120);
		assertThat(response.warning()).isNull();
	}

	@Test
	void persistPlan_whenSelectedTaskDisappeared_throwsConflictException() {
		LocalDate planDate = LocalDate.of(2026, 8, 28);
		List<AiPlanItem> aiItems = List.of(new AiPlanItem(1L, 1));

		when(userRepository.findById(1L)).thenReturn(Optional.of(new User()));
		when(taskQueryService.findOwnedTasksByIds(1L, List.of(1L))).thenReturn(List.of());

		assertThatThrownBy(() -> persister.persistPlan(1L, planDate, aiItems, 120))
				.isInstanceOf(ConflictException.class)
				.hasMessage("a selected task is no longer available");
	}

	private Task createTask(Long id, User owner, String title, Integer estimatedMinutes) {
		Task task = new Task();
		task.setTitle(title);
		task.setEstimatedMinutes(estimatedMinutes);
		ReflectionTestUtils.setField(task, "id", id);
		return task;
	}
}
