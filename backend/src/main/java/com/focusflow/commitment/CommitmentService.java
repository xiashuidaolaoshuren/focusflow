package com.focusflow.commitment;

import com.focusflow.commitment.dto.CommitmentRequest;
import com.focusflow.commitment.dto.CommitmentResponse;
import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommitmentService {

	private final CommitmentRepository commitmentRepository;
	private final CurrentUser currentUser;
	private final OwnerSchedulingLock ownerSchedulingLock;

	public CommitmentService(
			CommitmentRepository commitmentRepository,
			CurrentUser currentUser,
			OwnerSchedulingLock ownerSchedulingLock) {
		this.commitmentRepository = commitmentRepository;
		this.currentUser = currentUser;
		this.ownerSchedulingLock = ownerSchedulingLock;
	}

	public List<CommitmentResponse> list(LocalDate from, LocalDate to) {
		if (from == null || to == null) {
			throw new BadRequestException("from and to are required");
		}
		if (from.isAfter(to)) {
			throw new BadRequestException("from must not be after to");
		}
		Long ownerId = currentUser.getCurrentUser().id();
		return commitmentRepository
				.findByOwner_IdAndCommitmentDateBetweenOrderByCommitmentDateAscStartTimeAsc(
						ownerId, from, to)
				.stream()
				.map(this::toResponse)
				.toList();
	}

	@Transactional
	public CommitmentResponse create(CommitmentRequest request) {
		CommitmentValidator.validate(request);
		Long ownerId = currentUser.getCurrentUser().id();
		User owner = ownerSchedulingLock.lockCurrentOwner();
		CommitmentValidator.validateNoOverlap(
				request,
				commitmentRepository.findByOwner_IdAndCommitmentDate(
						ownerId, request.commitmentDate()),
				null);
		Commitment commitment = new Commitment();
		commitment.setOwner(owner);
		commitment.setTitle(request.title());
		commitment.setCommitmentDate(request.commitmentDate());
		commitment.setStartTime(request.startTime());
		commitment.setEndTime(request.endTime());
		return toResponse(commitmentRepository.save(commitment));
	}

	@Transactional
	public CommitmentResponse update(Long id, CommitmentRequest request) {
		CommitmentValidator.validate(request);
		Long ownerId = currentUser.getCurrentUser().id();
		Commitment commitment =
				commitmentRepository
						.findByOwner_IdAndId(ownerId, id)
						.orElseThrow(() -> new NotFoundException("commitment not found"));
		ownerSchedulingLock.lockCurrentOwner();
		CommitmentValidator.validateNoOverlap(
				request,
				commitmentRepository.findByOwner_IdAndCommitmentDate(
						ownerId, request.commitmentDate()),
				commitment.getId());
		commitment.setTitle(request.title());
		commitment.setCommitmentDate(request.commitmentDate());
		commitment.setStartTime(request.startTime());
		commitment.setEndTime(request.endTime());
		return toResponse(commitmentRepository.save(commitment));
	}

	@Transactional
	public void delete(Long id) {
		Long ownerId = currentUser.getCurrentUser().id();
		Commitment commitment =
				commitmentRepository
						.findByOwner_IdAndId(ownerId, id)
						.orElseThrow(() -> new NotFoundException("commitment not found"));
		ownerSchedulingLock.lockCurrentOwner();
		commitmentRepository.delete(commitment);
	}

	private CommitmentResponse toResponse(Commitment commitment) {
		return new CommitmentResponse(
				commitment.getId(),
				commitment.getTitle(),
				commitment.getCommitmentDate(),
				commitment.getStartTime(),
				commitment.getEndTime());
	}
}
