package com.focusflow.plan;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.ConflictException;
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
		boolean crossing = !request.finish() && isCrossing(plan, block, request.cutoff());
		requireReconcilableBlock(block, crossing, request);
		if (crossing) {
			requireReconciliationInputs(request);
		} else {
			requireValidActualMinutes(request);
		}
		requireMatchingProgressVersion(block, request.expectedProgressVersion());
		boolean correction = block.getOutcome() != null;

		if (request.finish()) {
			applyRemainingEffort(task, plan.getPlanDate(), 0, true);
			task.setStatus(TaskStatus.DONE);
		} else if (crossing) {
			applyReconciliation(plan, block, task, request);
		} else if (request.checkpoint() != null) {
			applyRemainingEffort(
					task, plan.getPlanDate(), request.checkpoint().remainingEffortMinutes(), true);
		} else if (correction) {
			applyCorrection(plan, block, task, request);
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
		if (!correction) {
			block.setRecordedAt(Instant.now());
		}
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

	/**
	 * A crossing block starts before the re-plan cutoff and ends after it, and still sits on the
	 * actionable revision. Its reconciliation replaces the block's provisional credit with the
	 * explicit values the user entered.
	 */
	private static boolean isCrossing(DailyPlan plan, DailyPlanBlock block, LocalTime cutoff) {
		if (cutoff == null || block.getRevision() != plan.getLatestRevision()) {
			return false;
		}
		return block.getStartTime().isBefore(cutoff) && cutoff.isBefore(block.getEndTime());
	}

	/**
	 * Reconciliation stores the known actual minutes, including a known zero, and the required
	 * checkpoint as the remainder. The block never receives its planned-duration credit, and the
	 * marker keeps ordinary done-credit from being applied later.
	 */
	private void applyReconciliation(
			DailyPlan plan, DailyPlanBlock block, Task task, BlockProgressRequest request) {
		applyRemainingEffort(
				task, plan.getPlanDate(), request.checkpoint().remainingEffortMinutes(), true);
		block.setReconciled(true);
	}

	private static void requireReconciliationInputs(BlockProgressRequest request) {
		if (request.actualMinutes() == null || request.actualMinutes() < 0) {
			throw new BadRequestException(
					"a crossing reconciliation requires known actual minutes of zero or more");
		}
		if (request.checkpoint() == null) {
			throw new BadRequestException(
					"a crossing reconciliation requires a remaining effort checkpoint");
		}
	}

	/**
	 * A reconciled block already replaced its credit with an explicit assessment, so it accepts only
	 * another crossing reconciliation or a whole-task finish.
	 */
	private static void requireReconcilableBlock(
			DailyPlanBlock block, boolean crossing, BlockProgressRequest request) {
		if (block.isReconciled() && !crossing && !request.finish()) {
			throw notRecordable();
		}
	}

	/**
	 * A correction reverses the credit the recorded outcome granted and applies the credit of the
	 * replacement outcome, so history-only edits never double-count progress. A checkpoint recorded
	 * at or after the block itself already replaced that credit, in which case the correction
	 * changes history only.
	 */
	private void applyCorrection(
			DailyPlan plan, DailyPlanBlock block, Task task, BlockProgressRequest request) {
		if (isShieldedByLaterCheckpoint(block, task)) {
			return;
		}
		Integer adjustment = correctionAdjustment(plan, block, task, request);
		if (adjustment == null) {
			return;
		}
		Integer adjusted = task.getRemainingEffortMinutes() + adjustment;
		if (adjusted <= 0) {
			throw new BadRequestException(
					"REMAINDER_UNRESOLVED",
					"the remainder would be exhausted without finishing or reassessing it");
		}
		applyRemainingEffort(task, plan.getPlanDate(), adjusted, false);
	}

	private boolean isShieldedByLaterCheckpoint(DailyPlanBlock block, Task task) {
		Instant latestCheckpointAt = taskService.latestCheckpointRecordedAt(task);
		Instant recordedAt = block.getRecordedAt();
		return latestCheckpointAt != null
				&& recordedAt != null
				&& !latestCheckpointAt.isBefore(recordedAt);
	}

	private Integer correctionAdjustment(
			DailyPlan plan, DailyPlanBlock block, Task task, BlockProgressRequest request) {
		if (task.getRemainingEffortMinutes() == null) {
			return null;
		}
		int plannedMinutes = plannedMinutes(block);
		int previousCredit =
				credit(
						WorkOutcome.valueOf(block.getOutcome()),
						plannedMinutes,
						block.getActualMinutes());
		int nextCredit = credit(request.outcome(), plannedMinutes, request.actualMinutes());
		return previousCredit - nextCredit;
	}

	private static int credit(WorkOutcome outcome, int plannedMinutes, Integer actualMinutes) {
		if (outcome == WorkOutcome.DONE) {
			return plannedMinutes;
		}
		if (outcome == WorkOutcome.PARTLY_DONE) {
			return actualMinutes != null ? actualMinutes : 0;
		}
		return 0;
	}

	private static void requireMatchingProgressVersion(
			DailyPlanBlock block, Integer expectedProgressVersion) {
		if (expectedProgressVersion != null
				&& expectedProgressVersion != block.getProgressVersion()) {
			throw new ConflictException("PROGRESS_CONFLICT", "block progress has changed");
		}
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
		if (block.getKind() != BlockKind.WORK) {
			throw notRecordable();
		}
		DailyPlanTask planTask = block.getDailyPlanTask();
		Task task = planTask != null ? planTask.getTaskReference() : null;
		if (task == null) {
			throw notRecordable();
		}
		BlockDisplayState state = BlockDisplayState.of(plan, block);
		if (state == BlockDisplayState.SUPERSEDED || state == BlockDisplayState.NO_LONGER_NEEDED) {
			throw notRecordable();
		}
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
