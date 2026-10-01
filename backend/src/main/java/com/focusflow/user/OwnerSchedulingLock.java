package com.focusflow.user;

import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Component
public class OwnerSchedulingLock {

	private final CurrentUser currentUser;
	private final UserRepository userRepository;

	public OwnerSchedulingLock(CurrentUser currentUser, UserRepository userRepository) {
		this.currentUser = currentUser;
		this.userRepository = userRepository;
	}

	@Transactional(propagation = Propagation.MANDATORY)
	public User lockCurrentOwner() {
		Long ownerId = currentUser.getCurrentUser().id();
		return userRepository
				.findByIdForUpdate(ownerId)
				.orElseThrow(() -> new NotFoundException("user not found"));
	}
}
