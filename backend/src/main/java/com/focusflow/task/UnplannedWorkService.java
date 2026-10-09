package com.focusflow.task;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import com.focusflow.task.dto.UnplannedWorkRequest;
import com.focusflow.task.dto.UnplannedWorkResponse;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.Instant;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UnplannedWorkService {

	private final CurrentUser currentUser;
	private final OwnerSchedulingLock ownerSchedulingLock;
	private final TaskRepository taskRepository;
	private final UnplannedWorkRepository unplannedWorkRepository;
	private final TaskService taskService;

	public UnplannedWorkService(
			CurrentUser currentUser,
			OwnerSchedulingLock ownerSchedulingLock,
			TaskRepository taskRepository,
			UnplannedWorkRepository unplannedWorkRepository,
			TaskService taskService) {
		this.currentUser = currentUser;
		this.ownerSchedulingLock = ownerSchedulingLock;
		this.taskRepository = taskRepository;
		this.unplannedWorkRepository = unplannedWorkRepository;
		this.taskService = taskService;
	}

	@Transactional
	public void delete(Long entryId, Integer effortVersion) {
		Long ownerId = currentUser.getCurrentUser().id();
		ownerSchedulingLock.lockCurrentOwner();
		UnplannedWork entry = loadEntry(ownerId, entryId);
		Task task = loadTask(ownerId, entry.getSourceTaskId());
		requireMatchingEffortVersion(task, effortVersion);

		if (!isShieldedByLaterCheckpoint(entry, task)) {
			reverseCredit(task, entry);
			taskRepository.save(task);
		}
		unplannedWorkRepository.delete(entry);
	}

	@Transactional
	public UnplannedWorkResponse correct(Long entryId, UnplannedWorkRequest request) {
		Long ownerId = currentUser.getCurrentUser().id();
		ownerSchedulingLock.lockCurrentOwner();
		UnplannedWork entry = loadEntry(ownerId, entryId);
		Task task = loadTask(ownerId, request.taskId());
		requireValidCreate(request);
		requireMatchingEffortVersion(task, request.effortVersion());
		requireStoredWorkDate(entry, request);

		int previousMinutes = entry.getActualMinutes();
		entry.setActualMinutes(request.actualMinutes());
		if (!isShieldedByLaterCheckpoint(entry, task)) {
			applyMinuteCorrection(task, request.workDate(), previousMinutes, request.actualMinutes());
		}

		taskRepository.save(task);
		return toResponse(unplannedWorkRepository.save(entry));
	}

	@Transactional
	public UnplannedWorkResponse create(UnplannedWorkRequest request) {
		Long ownerId = currentUser.getCurrentUser().id();
		User owner = ownerSchedulingLock.lockCurrentOwner();
		Task task = loadTask(ownerId, request.taskId());
		requireValidCreate(request);
		requireMatchingEffortVersion(task, request.effortVersion());
		requireResolvableRemainder(task, request);

		UnplannedWork entry = newEntry(owner, task, request);

		if (request.finish()) {
			applyRemainingEffort(task, request.workDate(), 0, true);
			task.setStatus(TaskStatus.DONE);
		} else if (request.checkpoint() != null) {
			applyRemainingEffort(
					task,
					request.workDate(),
					request.checkpoint().remainingEffortMinutes(),
					true);
		} else {
			Integer credited = provisionalRemaining(task, request);
			applyRemainingEffort(task, request.workDate(), credited, false);
		}
		if (task.getStatus() == TaskStatus.OPEN) {
			task.setStatus(TaskStatus.IN_PROGRESS);
		}

		taskRepository.save(task);
		UnplannedWork saved = unplannedWorkRepository.save(entry);
		return toResponse(saved);
	}

	private Integer provisionalRemaining(Task task, UnplannedWorkRequest request) {
		Integer remaining = task.getRemainingEffortMinutes();
		if (remaining == null) {
			return null;
		}
		return remaining - request.actualMinutes();
	}

	private void applyRemainingEffort(
			Task task, java.time.LocalDate workDate, Integer remainingMinutes, boolean checkpoint) {
		if (!Objects.equals(remainingMinutes, task.getRemainingEffortMinutes())) {
			task.setRemainingEffortMinutes(remainingMinutes);
			task.setEffortVersion(task.getEffortVersion() + 1);
		}
		if (checkpoint) {
			taskService.recordRemainingEffortCheckpoint(task, workDate, remainingMinutes);
		}
	}

	private UnplannedWork newEntry(User owner, Task task, UnplannedWorkRequest request) {
		UnplannedWork entry = new UnplannedWork();
		entry.setOwner(owner);
		entry.setSourceTaskId(task.getId());
		entry.setTaskReference(task);
		entry.setWorkDate(request.workDate());
		entry.setActualMinutes(request.actualMinutes());
		entry.setRecordedAt(Instant.now());
		return entry;
	}

	private UnplannedWorkResponse toResponse(UnplannedWork entry) {
		Task taskReference = entry.getTaskReference();
		return new UnplannedWorkResponse(
				entry.getId(),
				entry.getSourceTaskId(),
				taskReference != null ? taskReference.getId() : null,
				entry.getWorkDate(),
				entry.getActualMinutes(),
				entry.getRecordedAt());
	}

	private UnplannedWork loadEntry(Long ownerId, Long entryId) {
		return unplannedWorkRepository
				.findByOwner_IdAndId(ownerId, entryId)
				.orElseThrow(() -> new NotFoundException("unplanned work not found"));
	}

	private Task loadTask(Long ownerId, Long taskId) {
		return taskRepository
				.findByOwner_IdAndId(ownerId, taskId)
				.orElseThrow(() -> new NotFoundException("task not found"));
	}

	private void reverseCredit(Task task, UnplannedWork entry) {
		if (task.getRemainingEffortMinutes() == null) {
			return;
		}
		int reversed = task.getRemainingEffortMinutes() + entry.getActualMinutes();
		applyRemainingEffort(task, entry.getWorkDate(), reversed, false);
	}

	private void applyMinuteCorrection(
			Task task, java.time.LocalDate workDate, int previousMinutes, int newMinutes) {
		if (task.getRemainingEffortMinutes() == null) {
			return;
		}
		int adjusted = task.getRemainingEffortMinutes() + previousMinutes - newMinutes;
		if (adjusted <= 0) {
			throw new BadRequestException(
					"REMAINDER_UNRESOLVED",
					"the remainder would be exhausted without finishing or reassessing it");
		}
		applyRemainingEffort(task, workDate, adjusted, false);
	}

	private boolean isShieldedByLaterCheckpoint(UnplannedWork entry, Task task) {
		Instant latestCheckpointAt = taskService.latestCheckpointRecordedAt(task);
		Instant recordedAt = entry.getRecordedAt();
		return latestCheckpointAt != null
				&& recordedAt != null
				&& !latestCheckpointAt.isBefore(recordedAt);
	}

	private static void requireStoredWorkDate(UnplannedWork entry, UnplannedWorkRequest request) {
		if (!entry.getWorkDate().equals(request.workDate())) {
			throw new BadRequestException("work date cannot be changed");
		}
	}

	private static void requireValidCreate(UnplannedWorkRequest request) {
		if (request.actualMinutes() == null || request.actualMinutes() <= 0) {
			throw new BadRequestException("actual minutes must be positive");
		}
		if (request.currentDate() == null) {
			throw new BadRequestException("current date is required");
		}
		if (request.workDate().isAfter(request.currentDate())) {
			throw new BadRequestException("FUTURE_ACTUAL", "work date is after the current date");
		}
	}

	private static void requireMatchingEffortVersion(Task task, Integer expectedEffortVersion) {
		if (expectedEffortVersion != null && expectedEffortVersion != task.getEffortVersion()) {
			throw new ConflictException("PROGRESS_CONFLICT", "task effort has changed");
		}
	}

	private void requireResolvableRemainder(Task task, UnplannedWorkRequest request) {
		if (request.finish() || request.checkpoint() != null) {
			return;
		}
		Integer credited = provisionalRemaining(task, request);
		if (credited != null && credited <= 0) {
			throw new BadRequestException(
					"REMAINDER_UNRESOLVED",
					"the remainder would be exhausted without finishing or reassessing it");
		}
	}
}
