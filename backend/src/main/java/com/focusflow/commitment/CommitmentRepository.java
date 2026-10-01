package com.focusflow.commitment;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CommitmentRepository extends JpaRepository<Commitment, Long> {

	Optional<Commitment> findByOwner_IdAndId(Long ownerId, Long id);

	List<Commitment> findByOwner_IdAndCommitmentDate(Long ownerId, LocalDate commitmentDate);

	List<Commitment> findByOwner_IdAndCommitmentDateBetweenOrderByCommitmentDateAscStartTimeAsc(
			Long ownerId, LocalDate fromInclusive, LocalDate toInclusive);
}
