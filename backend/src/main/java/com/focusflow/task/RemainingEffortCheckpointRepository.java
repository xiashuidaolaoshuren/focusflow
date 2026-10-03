package com.focusflow.task;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RemainingEffortCheckpointRepository
		extends JpaRepository<RemainingEffortCheckpoint, Long> {

	boolean existsByTaskReference_Id(Long taskReferenceId);

	List<RemainingEffortCheckpoint> findByTaskReference_Id(Long taskReferenceId);
}
