package com.focusflow.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

import com.focusflow.dependency.DependencyLink;
import com.focusflow.task.dto.TaskLinkResponse;
import com.focusflow.task.dto.TaskResponse;
import com.focusflow.user.User;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TaskResponseMapperTest {

	@Mock
	private TaskQueryService taskQueryService;

	@InjectMocks
	private TaskResponseMapper taskResponseMapper;

	@Test
	void toResponse_buildsBlockedByAndBlocksWithTitlesAndStatuses() {
		User owner = userWithId(99L);

		Task task = sampleTask(5L, owner, "Blocked task");
		Task blocker = sampleTask(3L, owner, "Blocker");
		Task blocked = sampleTask(7L, owner, "Successor");

		when(taskQueryService.findLinksByOwnerId(99L))
				.thenReturn(
						List.of(
								new DependencyLink(3L, 5L, true),
								new DependencyLink(5L, 7L, false)));
		when(taskQueryService.findOwnedTasksByIds(eq(99L), any()))
				.thenReturn(List.of(blocker, blocked));

		TaskResponse response = taskResponseMapper.toResponse(task);

		assertThat(response.blockedBy())
				.containsExactly(new TaskLinkResponse(3L, "Blocker", TaskStatus.OPEN));
		assertThat(response.blocks())
				.containsExactly(new TaskLinkResponse(7L, "Successor", TaskStatus.OPEN));
	}

	@Test
	void toResponses_batchLoadsLinksOnce() {
		User owner = userWithId(99L);

		Task first = sampleTask(1L, owner, "One");
		Task second = sampleTask(2L, owner, "Two");
		Task blocker = sampleTask(10L, owner, "Blocker");

		when(taskQueryService.findLinksByOwnerId(99L))
				.thenReturn(List.of(new DependencyLink(10L, 2L, true)));
		when(taskQueryService.findOwnedTasksByIds(eq(99L), any()))
				.thenReturn(List.of(blocker));

		List<TaskResponse> responses =
				taskResponseMapper.toResponses(List.of(first, second));

		assertThat(responses).hasSize(2);
		assertThat(responses.get(0).blockedBy()).isEmpty();
		assertThat(responses.get(0).blocks()).isEmpty();
		assertThat(responses.get(1).blockedBy())
				.containsExactly(new TaskLinkResponse(10L, "Blocker", TaskStatus.OPEN));
		verify(taskQueryService).findLinksByOwnerId(99L);
		verify(taskQueryService).findOwnedTasksByIds(eq(99L), any());
		verifyNoMoreInteractions(taskQueryService);
	}

	private static User userWithId(long id) {
		User user = new User();
		try {
			var idField = User.class.getDeclaredField("id");
			idField.setAccessible(true);
			idField.set(user, id);
		} catch (ReflectiveOperationException ex) {
			throw new RuntimeException(ex);
		}
		return user;
	}

	private static Task sampleTask(long id, User owner, String title) {
		Task task = new Task();
		task.setOwner(owner);
		task.setTitle(title);
		task.setPriority(TaskPriority.MEDIUM);
		task.setStatus(TaskStatus.OPEN);
		task.setDueDate(LocalDate.of(2026, 1, 15));
		task.setEstimatedMinutes(60);
		task.setRemainingEffortMinutes(60);
		task.setEffortVersion(0);
		try {
			var idField = Task.class.getDeclaredField("id");
			idField.setAccessible(true);
			idField.set(task, id);
		} catch (ReflectiveOperationException ex) {
			throw new RuntimeException(ex);
		}
		return task;
	}
}
