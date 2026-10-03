package com.focusflow.task;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RemainingEffortCheckpointRepository
		extends JpaRepository<RemainingEffortCheckpoint, Long> {

	boolean existsByTaskReference_Id(Long taskReferenceId);

	List<RemainingEffortCheckpoint> findByTaskReference_Id(Long taskReferenceId);

	/**
	 * The latest recorded checkpoint for a Task, most recent recording first.
	 */
	Optional<RemainingEffortCheckpoint> findFirstByTaskReference_IdOrderByRecordedAtDesc(
			Long taskReferenceId);

	/**
	 * Entity-argument overload for callers that already hold the Task. Executed as written rather
	 * than derived, so the Task parameter never has to be bound onto the id path.
	 */
	default Optional<RemainingEffortCheckpoint> findFirstByTaskReference_IdOrderByRecordedAtDesc(
			Task taskReference) {
		Long taskId = taskReference.getId();
		return taskId == null
				? Optional.empty()
				: findFirstByTaskReference_IdOrderByRecordedAtDesc(taskId);
	}
}
