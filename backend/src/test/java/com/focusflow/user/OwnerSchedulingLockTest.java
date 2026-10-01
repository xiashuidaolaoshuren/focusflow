package com.focusflow.user;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.NotFoundException;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.testsupport.DailyPlanAiTestConfiguration;
import com.focusflow.testsupport.PostgresTestcontainerConfig;
import com.focusflow.testsupport.UserTestBuilder;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

@ExtendWith(MockitoExtension.class)
class OwnerSchedulingLockTest {

	@Mock
	private UserRepository userRepository;

	@Mock
	private CurrentUser currentUser;

	private OwnerSchedulingLock ownerSchedulingLock;

	@BeforeEach
	void setUp() {
		ownerSchedulingLock = new OwnerSchedulingLock(currentUser, userRepository);
	}

	@Test
	void lockCurrentOwner_loadsCurrentUserForUpdate() {
		UserContext current = new UserContext(42L, "owner@example.com", "owner");
		when(currentUser.getCurrentUser()).thenReturn(current);

		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(userRepository.findByIdForUpdate(42L)).thenReturn(Optional.of(owner));

		User locked = ownerSchedulingLock.lockCurrentOwner();

		verify(userRepository).findByIdForUpdate(42L);
		assertThat(locked).isSameAs(owner);
	}

	@Test
	void lockCurrentOwner_whenOwnerMissing_throwsNotFoundException() {
		UserContext current = new UserContext(99L, "missing@example.com", "missing");
		when(currentUser.getCurrentUser()).thenReturn(current);
		when(userRepository.findByIdForUpdate(99L)).thenReturn(Optional.empty());

		assertThatThrownBy(() -> ownerSchedulingLock.lockCurrentOwner())
				.isInstanceOf(NotFoundException.class)
				.hasMessage("user not found");
	}

	@Nested
	@SpringBootTest
	@ActiveProfiles("test")
	@Import({DailyPlanAiTestConfiguration.class, PostgresTestcontainerConfig.class})
	class TransactionIntegration {

		private static final String LOCK_OWNER_USERNAME = "sched-lock-owner";

		@Autowired OwnerSchedulingLock ownerSchedulingLock;

		@Autowired UserRepository userRepository;

		@Autowired TransactionTemplate transactionTemplate;

		@Autowired JdbcTemplate jdbcTemplate;

		@BeforeEach
		void seedOwner() {
			if (userRepository.findByUsername(LOCK_OWNER_USERNAME).isEmpty()) {
				userRepository.save(
						UserTestBuilder.user()
								.withUsername(LOCK_OWNER_USERNAME)
								.withEmail("sched-lock-owner@example.com")
								.withPasswordHash(
										"$2a$10$cccccccccccccccccccccccccccccccccccccccccccccccccccccccc")
								.build());
			}
		}

		@Test
		@WithMockUser(username = LOCK_OWNER_USERNAME)
		void lockCurrentOwner_outsideTransaction_throwsIllegalTransactionStateException() {
			assertThatThrownBy(() -> ownerSchedulingLock.lockCurrentOwner())
					.isInstanceOf(IllegalTransactionStateException.class);
		}

		@Test
		@WithMockUser(username = LOCK_OWNER_USERNAME)
		void lockCurrentOwner_holdsRowUntilCallerTransactionCommits() throws Exception {
			Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
			CountDownLatch lockHeld = new CountDownLatch(1);
			CountDownLatch releaseLock = new CountDownLatch(1);
			AtomicBoolean concurrentLockSucceeded = new AtomicBoolean(false);

			Thread holdingThread =
					new Thread(
							() ->
									runWithAuthentication(
											authentication,
											() ->
													transactionTemplate.executeWithoutResult(
															status -> {
																ownerSchedulingLock.lockCurrentOwner();
																lockHeld.countDown();
																try {
																	releaseLock.await(5, TimeUnit.SECONDS);
																} catch (InterruptedException ex) {
																	Thread.currentThread().interrupt();
																}
															})));

			holdingThread.start();
			assertThat(lockHeld.await(5, TimeUnit.SECONDS)).isTrue();

			Thread competingThread =
					new Thread(
							() ->
									runWithAuthentication(
											authentication,
											() ->
													transactionTemplate.executeWithoutResult(
															status -> {
																jdbcTemplate.execute(
																		"SET LOCAL lock_timeout = '500ms'");
																try {
																	ownerSchedulingLock.lockCurrentOwner();
																	concurrentLockSucceeded.set(true);
																} catch (PessimisticLockingFailureException ex) {
																	// expected while the holder keeps the row locked
																}
															})));

			competingThread.start();
			competingThread.join(3_000);
			assertThat(concurrentLockSucceeded.get()).isFalse();

			releaseLock.countDown();
			holdingThread.join(5_000);

			transactionTemplate.executeWithoutResult(
					status -> {
						jdbcTemplate.execute("SET LOCAL lock_timeout = '2s'");
						ownerSchedulingLock.lockCurrentOwner();
					});
		}

		private static void runWithAuthentication(Authentication authentication, Runnable action) {
			SecurityContext context = SecurityContextHolder.createEmptyContext();
			context.setAuthentication(authentication);
			SecurityContextHolder.setContext(context);
			try {
				action.run();
			} finally {
				SecurityContextHolder.clearContext();
			}
		}
	}
}
