package com.focusflow.commitment;

import com.focusflow.schedule.CommitmentWindow;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommitmentQueryService {

	private final CommitmentRepository commitmentRepository;

	public CommitmentQueryService(CommitmentRepository commitmentRepository) {
		this.commitmentRepository = commitmentRepository;
	}

	@Transactional(readOnly = true)
	public List<CommitmentWindow> windowsFor(Long ownerId, LocalDate commitmentDate) {
		return commitmentRepository
				.findByOwner_IdAndCommitmentDate(ownerId, commitmentDate)
				.stream()
				.map(
						commitment ->
								new CommitmentWindow(
										commitment.getTitle(),
										commitment.getStartTime(),
										commitment.getEndTime()))
				.toList();
	}
}
