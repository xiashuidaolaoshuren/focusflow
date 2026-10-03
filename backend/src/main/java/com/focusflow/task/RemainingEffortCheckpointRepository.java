package com.focusflow.task;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RemainingEffortCheckpointRepository
		extends JpaRepository<RemainingEffortCheckpoint, Long> {

	boolean existsByTaskReference_Id(Long taskReferenceId);
}
