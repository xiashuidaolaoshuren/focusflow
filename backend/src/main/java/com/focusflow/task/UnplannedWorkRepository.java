package com.focusflow.task;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UnplannedWorkRepository extends JpaRepository<UnplannedWork, Long> {

	Optional<UnplannedWork> findByOwner_IdAndId(Long ownerId, Long id);

	boolean existsByTaskReference_Id(Long taskId);

	List<UnplannedWork> findByTaskReference_Id(Long taskId);
}
