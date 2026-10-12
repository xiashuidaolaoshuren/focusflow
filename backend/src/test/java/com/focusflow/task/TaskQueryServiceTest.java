package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.dependency.DependencyLink;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TaskQueryServiceTest {

	@Mock
	private TaskRepository taskRepository;

	@Mock
	private UnplannedWorkRepository unplannedWorkRepository;

	@Mock
	private TaskDependencyRepository taskDependencyRepository;

	@InjectMocks
	private TaskQueryService taskQueryService;

	@Test
	void findOpenTasksByOwnerId_delegatesToRepository() {
		Task task = new Task();
		task.setTitle("Open task");
		when(taskRepository.findByOwner_IdAndStatusOrderByDueDateAsc(42L, TaskStatus.OPEN))
				.thenReturn(List.of(task));

		List<Task> tasks = taskQueryService.findOpenTasksByOwnerId(42L);

		verify(taskRepository).findByOwner_IdAndStatusOrderByDueDateAsc(42L, TaskStatus.OPEN);
		assertThat(tasks).singleElement().satisfies(t -> assertThat(t.getTitle()).isEqualTo("Open task"));
	}

	@Test
	void findPlannableTasksByOwnerId_delegatesToRepositoryWithOpenAndInProgress() {
		Task task = new Task();
		task.setTitle("Plannable task");
		when(taskRepository.findByOwner_IdAndStatusInOrderByDueDateAsc(
						42L, List.of(TaskStatus.OPEN, TaskStatus.IN_PROGRESS)))
				.thenReturn(List.of(task));

		List<Task> tasks = taskQueryService.findPlannableTasksByOwnerId(42L);

		verify(taskRepository)
				.findByOwner_IdAndStatusInOrderByDueDateAsc(
						42L, List.of(TaskStatus.OPEN, TaskStatus.IN_PROGRESS));
		assertThat(tasks).singleElement().satisfies(t -> assertThat(t.getTitle()).isEqualTo("Plannable task"));
	}

	@Test
	void findLinksByOwnerId_mapsPlannableFromBlockerStatus() {
		TaskDependency openBlockerLink = new TaskDependency();
		openBlockerLink.setBlockerTaskId(10L);
		openBlockerLink.setBlockedTaskId(20L);
		TaskDependency doneBlockerLink = new TaskDependency();
		doneBlockerLink.setBlockerTaskId(30L);
		doneBlockerLink.setBlockedTaskId(40L);
		when(taskDependencyRepository.findByOwner_Id(42L))
				.thenReturn(List.of(openBlockerLink, doneBlockerLink));

		Task openBlocker = taskWithId(10L, TaskStatus.OPEN);
		Task doneBlocker = taskWithId(30L, TaskStatus.DONE);
		when(taskRepository.findByOwner_IdAndIdIn(eq(42L), any()))
				.thenReturn(List.of(openBlocker, doneBlocker));

		List<DependencyLink> links = taskQueryService.findLinksByOwnerId(42L);

		assertThat(links)
				.containsExactly(
						new DependencyLink(10L, 20L, true), new DependencyLink(30L, 40L, false));
	}

	private static Task taskWithId(long id, TaskStatus status) {
		Task task = new Task();
		try {
			var idField = Task.class.getDeclaredField("id");
			idField.setAccessible(true);
			idField.set(task, id);
		} catch (ReflectiveOperationException ex) {
			throw new RuntimeException(ex);
		}
		task.setStatus(status);
		return task;
	}
}
