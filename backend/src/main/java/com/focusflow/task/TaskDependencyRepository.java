package com.focusflow.task;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskDependencyRepository extends JpaRepository<TaskDependency, Long> {

	List<TaskDependency> findByOwner_Id(Long ownerId);

	boolean existsByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
			Long ownerId, long blockedTaskId, long blockerTaskId);

	Optional<TaskDependency> findByOwner_IdAndBlockedTaskIdAndBlockerTaskId(
			Long ownerId, long blockedTaskId, long blockerTaskId);
}
