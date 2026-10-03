package com.focusflow.plan;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.effort.EffortEvent;
import com.focusflow.effort.RemainingEffortCalculator;
import com.focusflow.effort.WorkOutcome;
import com.focusflow.plan.dto.BlockProgressRequest;
import com.focusflow.plan.dto.BlockProgressResponse;
import com.focusflow.schedule.BlockKind;
import com.focusflow.security.CurrentUser;
import com.focusflow.task.Task;
import com.focusflow.task.TaskResponseMapper;
import com.focusflow.task.TaskService;
import com.focusflow.task.TaskStatus;
import com.focusflow.user.OwnerSchedulingLock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BlockProgressService {

	private final CurrentUser currentUser;
	private final DailyPlanRepository dailyPlanRepository;
	private final OwnerSchedulingLock ownerSchedulingLock;
	private final TaskService taskService;
	private final TaskResponseMapper taskResponseMapper;
	private final DailyPlanResponseMapper dailyPlanResponseMapper;

	public BlockProgressService(
			CurrentUser currentUser,
			DailyPlanRepository dailyPlanRepository,
			OwnerSchedulingLock ownerSchedulingLock,
			TaskService taskService,
			TaskResponseMapper taskResponseMapper,
			DailyPlanResponseMapper dailyPlanResponseMapper) {
		this.currentUser = currentUser;
		this.dailyPlanRepository = dailyPlanRepository;
		this.ownerSchedulingLock = ownerSchedulingLock;
		this.taskService = taskService;
		this.taskResponseMapper = taskResponseMapper;
		this.dailyPlanResponseMapper = dailyPlanResponseMapper;
	}

	@Transactional
	public BlockProgressResponse record(Long planId, Long blockId, BlockProgressRequest request) {
		Long ownerId = currentUser.getCurrentUser().id();
		ownerSchedulingLock.lockCurrentOwner();
		DailyPlan plan =
				dailyPlanRepository
						.findByOwner_IdAndId(ownerId, planId)
						.orElseThrow(() -> new NotFoundException("daily plan not found"));
		requireNotFuture(plan, request);
		DailyPlanBlock block = findBlock(plan, blockId);
		requireRecordable(plan, block);
		Task task = block.getDailyPlanTask().getTaskReference();
		requireValidActualMinutes(request);

		if (request.finish()) {
			applyRemainingEffort(task, plan.getPlanDate(), 0, true);
			task.setStatus(TaskStatus.DONE);
		} else if (request.checkpoint() != null) {
			applyRemainingEffort(
					task, plan.getPlanDate(), request.checkpoint().remainingEffortMinutes(), true);
		} else {
			Integer credited = provisionalRemaining(plan, block, task, request);
			if (credited != null && credited <= 0) {
				throw new BadRequestException(
						"REMAINDER_UNRESOLVED",
						"the remainder would be exhausted without finishing or reassessing it");
			}
			applyRemainingEffort(task, plan.getPlanDate(), credited, false);
		}
		if (task.getStatus() == TaskStatus.OPEN && startsWork(request.outcome())) {
			task.setStatus(TaskStatus.IN_PROGRESS);
		}

		block.setOutcome(request.outcome().name());
		block.setActualMinutes(request.actualMinutes());
		block.setRecordedAt(Instant.now());
		block.setProgressVersion(block.getProgressVersion() + 1);

		return new BlockProgressResponse(
				taskResponseMapper.toResponse(task), dailyPlanResponseMapper.toResponse(plan));
	}

	private void applyRemainingEffort(
			Task task, LocalDate workDate, Integer remainingMinutes, boolean checkpoint) {
		if (!Objects.equals(remainingMinutes, task.getRemainingEffortMinutes())) {
			task.setRemainingEffortMinutes(remainingMinutes);
			task.setEffortVersion(task.getEffortVersion() + 1);
		}
		if (checkpoint) {
			taskService.recordRemainingEffortCheckpoint(task, workDate, remainingMinutes);
		}
	}

	private Integer provisionalRemaining(
			DailyPlan plan, DailyPlanBlock block, Task task, BlockProgressRequest request) {
		Integer remaining = task.getRemainingEffortMinutes();
		EffortEvent.WorkCredit credit = creditFor(plan, block, task, request);
		if (remaining == null || credit == null) {
			return remaining;
		}
		return RemainingEffortCalculator.apply(remaining, List.of(credit)).remainingMinutes();
	}

	private static void requireNotFuture(DailyPlan plan, BlockProgressRequest request) {
		if (request.currentDate() == null) {
			throw new BadRequestException("current date is required");
		}
		if (plan.getPlanDate().isAfter(request.currentDate())) {
			throw new BadRequestException("FUTURE_ACTUAL", "work date is after the current date");
		}
	}

	private static void requireRecordable(DailyPlan plan, DailyPlanBlock block) {
		if (block.getKind() != BlockKind.WORK || block.getOutcome() != null) {
			throw notRecordable();
		}
		DailyPlanTask planTask = block.getDailyPlanTask();
		Task task = planTask != null ? planTask.getTaskReference() : null;
		if (task == null) {
			throw notRecordable();
		}
		if (task.getStatus() == TaskStatus.DONE || task.getStatus() == TaskStatus.CANCELLED) {
			throw notRecordable();
		}
		if (isSuperseded(plan, block)) {
			throw notRecordable();
		}
	}

	/**
	 * A block still sits on an older revision, that revision is no longer the latest, and the block
	 * begins at or after the latest revision's cutoff. Such a block is read-only.
	 */
	private static boolean isSuperseded(DailyPlan plan, DailyPlanBlock block) {
		DailyPlanRevision latest = plan.getLatestRevision();
		if (latest == block.getRevision()) {
			return false;
		}
		LocalTime cutoff =
				latest.getCutoffTime() != null ? latest.getCutoffTime() : plan.getWindowStart();
		return !block.getStartTime().isBefore(cutoff);
	}

	private static BadRequestException notRecordable() {
		return new BadRequestException(
				"BLOCK_NOT_RECORDABLE", "block is not open for a new outcome");
	}

	private static boolean startsWork(WorkOutcome outcome) {
		return outcome == WorkOutcome.DONE || outcome == WorkOutcome.PARTLY_DONE;
	}

	private static void requireValidActualMinutes(BlockProgressRequest request) {
		if (request.outcome() == WorkOutcome.PARTLY_DONE
				&& (request.actualMinutes() == null || request.actualMinutes() <= 0)) {
			throw new BadRequestException("partly done requires positive actual minutes");
		}
	}

	private EffortEvent.WorkCredit creditFor(
			DailyPlan plan, DailyPlanBlock block, Task task, BlockProgressRequest request) {
		WorkOutcome outcome = request.outcome();
		if (outcome != WorkOutcome.DONE && outcome != WorkOutcome.PARTLY_DONE) {
			return null;
		}
		return new EffortEvent.WorkCredit(
				plan.getPlanDate(),
				Instant.now(),
				task.getEffortVersion() + 1L,
				outcome,
				plannedMinutes(block),
				request.actualMinutes());
	}

	private DailyPlanBlock findBlock(DailyPlan plan, Long blockId) {
		for (DailyPlanRevision revision : plan.getRevisions()) {
			for (DailyPlanBlock block : revision.getBlocks()) {
				if (block.getId() != null && block.getId().equals(blockId)) {
					return block;
				}
			}
		}
		throw new NotFoundException("daily plan block not found");
	}

	private static int plannedMinutes(DailyPlanBlock block) {
		return (int) Duration.between(block.getStartTime(), block.getEndTime()).toMinutes();
	}
}
