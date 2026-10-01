package com.focusflow.commitment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.focusflow.common.error.BadRequestException;
import com.focusflow.common.error.NotFoundException;
import com.focusflow.commitment.dto.CommitmentRequest;
import com.focusflow.commitment.dto.CommitmentResponse;
import com.focusflow.security.CurrentUser;
import com.focusflow.security.UserContext;
import com.focusflow.user.OwnerSchedulingLock;
import com.focusflow.user.User;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CommitmentServiceTest {

	@Mock
	private CommitmentRepository commitmentRepository;

	@Mock
	private CurrentUser currentUser;

	@Mock
	private OwnerSchedulingLock ownerSchedulingLock;

	private CommitmentService commitmentService;

	@BeforeEach
	void setUp() {
		commitmentService =
				new CommitmentService(commitmentRepository, currentUser, ownerSchedulingLock);
	}

	@Test
	void delete_whenOwned_locksAndDeletes() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);

		Commitment existing = new Commitment();
		existing.setOwner(owner);
		existing.setTitle("Standup");
		when(commitmentRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(java.util.Optional.of(existing));

		commitmentService.delete(7L);

		verify(ownerSchedulingLock).lockCurrentOwner();
		verify(commitmentRepository).delete(existing);
	}

	@Test
	void delete_whenNotOwned_throwsNotFoundException() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(commitmentRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(java.util.Optional.empty());

		assertThatThrownBy(() -> commitmentService.delete(99L))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("commitment not found");

		verify(commitmentRepository, never()).delete(any(Commitment.class));
	}

	@Test
	void update_movesDateAndReplacesWindow() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);

		Commitment existing = new Commitment();
		existing.setOwner(owner);
		existing.setTitle("Old title");
		existing.setCommitmentDate(LocalDate.of(2026, 9, 21));
		existing.setStartTime(LocalTime.of(10, 0));
		existing.setEndTime(LocalTime.of(10, 30));

		when(commitmentRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(java.util.Optional.of(existing));
		when(commitmentRepository.findByOwner_IdAndCommitmentDate(42L, LocalDate.of(2026, 9, 22)))
				.thenReturn(List.of());
		when(commitmentRepository.save(existing)).thenAnswer(invocation -> invocation.getArgument(0));

		CommitmentRequest request =
				validRequest()
						.withTitle("New title")
						.withCommitmentDate(LocalDate.of(2026, 9, 22))
						.withStartTime(LocalTime.of(14, 0))
						.withEndTime(LocalTime.of(15, 0))
						.build();

		CommitmentResponse response = commitmentService.update(7L, request);

		assertThat(existing.getTitle()).isEqualTo("New title");
		assertThat(existing.getCommitmentDate()).isEqualTo(LocalDate.of(2026, 9, 22));
		assertThat(existing.getStartTime()).isEqualTo(LocalTime.of(14, 0));
		assertThat(existing.getEndTime()).isEqualTo(LocalTime.of(15, 0));
		assertThat(response.title()).isEqualTo("New title");
		assertThat(response.commitmentDate()).isEqualTo(LocalDate.of(2026, 9, 22));
	}

	@Test
	void update_whenNotOwned_throwsNotFoundException() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		when(commitmentRepository.findByOwner_IdAndId(42L, 99L)).thenReturn(java.util.Optional.empty());

		CommitmentRequest request = validRequest().build();

		assertThatThrownBy(() -> commitmentService.update(99L, request))
				.isInstanceOf(NotFoundException.class)
				.hasMessage("commitment not found");
	}

	@Test
	void update_whenOverlap_throwsBadRequestException() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);

		Commitment existing = new Commitment();
		existing.setOwner(owner);
		existing.setCommitmentDate(LocalDate.of(2026, 9, 21));
		existing.setStartTime(LocalTime.of(10, 0));
		existing.setEndTime(LocalTime.of(10, 30));

		Commitment other = new Commitment();
		other.setCommitmentDate(LocalDate.of(2026, 9, 21));
		other.setStartTime(LocalTime.of(11, 0));
		other.setEndTime(LocalTime.of(11, 30));

		when(commitmentRepository.findByOwner_IdAndId(42L, 7L)).thenReturn(java.util.Optional.of(existing));
		when(commitmentRepository.findByOwner_IdAndCommitmentDate(42L, LocalDate.of(2026, 9, 21)))
				.thenReturn(List.of(existing, other));

		CommitmentRequest request =
				validRequest()
						.withStartTime(LocalTime.of(11, 15))
						.withEndTime(LocalTime.of(11, 45))
						.build();

		assertThatThrownBy(() -> commitmentService.update(7L, request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("commitments must not overlap on the same date");
	}

	@Test
	void create_whenOverlap_throwsBadRequestException() {
		User owner = new User();
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		Commitment existing = new Commitment();
		existing.setTitle("Lunch");
		existing.setCommitmentDate(LocalDate.of(2026, 9, 21));
		existing.setStartTime(LocalTime.of(12, 0));
		existing.setEndTime(LocalTime.of(13, 0));
		when(commitmentRepository.findByOwner_IdAndCommitmentDate(42L, LocalDate.of(2026, 9, 21)))
				.thenReturn(List.of(existing));

		CommitmentRequest request =
				validRequest()
						.withStartTime(LocalTime.of(12, 30))
						.withEndTime(LocalTime.of(13, 30))
						.build();

		assertThatThrownBy(() -> commitmentService.create(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("commitments must not overlap on the same date");

		verify(commitmentRepository, never()).save(any(Commitment.class));
	}

	@Test
	void create_whenEndNotAfterStart_throwsBadRequestException() {
		CommitmentRequest request =
				validRequest()
						.withStartTime(LocalTime.of(10, 30))
						.withEndTime(LocalTime.of(10, 0))
						.build();

		assertThatThrownBy(() -> commitmentService.create(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("end time must be after start time");
	}

	@Test
	void create_whenTimeNotMinuteAligned_throwsBadRequestException() {
		CommitmentRequest request =
				validRequest().withStartTime(LocalTime.of(10, 0, 30)).build();

		assertThatThrownBy(() -> commitmentService.create(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("times must be minute-aligned");
	}

	@Test
	void create_whenTitleBlank_throwsBadRequestException() {
		CommitmentRequest request = validRequest().withTitle("   ").build();

		assertThatThrownBy(() -> commitmentService.create(request))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("title must not be blank");
	}

	@Test
	void create_locksOwnerAndPersists() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));
		User owner = new User();
		owner.setEmail("owner@example.com");
		owner.setUsername("owner");
		when(ownerSchedulingLock.lockCurrentOwner()).thenReturn(owner);
		when(commitmentRepository.findByOwner_IdAndCommitmentDate(
						eq(42L), eq(LocalDate.of(2026, 9, 21))))
				.thenReturn(List.of());
		when(commitmentRepository.save(any(Commitment.class)))
				.thenAnswer(invocation -> {
					Commitment saved = invocation.getArgument(0);
					saved.getClass(); // keep reference
					return saved;
				});

		CommitmentRequest request =
				new CommitmentRequest(
						"Standup",
						LocalDate.of(2026, 9, 21),
						LocalTime.of(10, 0),
						LocalTime.of(10, 30));

		CommitmentResponse response = commitmentService.create(request);

		verify(ownerSchedulingLock).lockCurrentOwner();
		ArgumentCaptor<Commitment> captor = ArgumentCaptor.forClass(Commitment.class);
		verify(commitmentRepository).save(captor.capture());
		Commitment saved = captor.getValue();
		assertThat(saved.getOwner()).isSameAs(owner);
		assertThat(saved.getTitle()).isEqualTo("Standup");
		assertThat(saved.getCommitmentDate()).isEqualTo(LocalDate.of(2026, 9, 21));
		assertThat(saved.getStartTime()).isEqualTo(LocalTime.of(10, 0));
		assertThat(saved.getEndTime()).isEqualTo(LocalTime.of(10, 30));
		assertThat(response.title()).isEqualTo("Standup");
		assertThat(response.commitmentDate()).isEqualTo(LocalDate.of(2026, 9, 21));
	}

	@Test
	void list_whenFromAfterTo_throwsBadRequestException() {
		LocalDate from = LocalDate.of(2026, 9, 22);
		LocalDate to = LocalDate.of(2026, 9, 20);

		assertThatThrownBy(() -> commitmentService.list(from, to))
				.isInstanceOf(BadRequestException.class)
				.hasMessage("from must not be after to");
	}

	@Test
	void list_returnsOwnerRowsInInclusiveRangeOrdered() {
		when(currentUser.getCurrentUser()).thenReturn(new UserContext(42L, "owner@example.com", "owner"));

		LocalDate from = LocalDate.of(2026, 9, 20);
		LocalDate to = LocalDate.of(2026, 9, 22);

		Commitment laterSameDay = new Commitment();
		laterSameDay.setTitle("Standup");
		laterSameDay.setCommitmentDate(LocalDate.of(2026, 9, 21));
		laterSameDay.setStartTime(LocalTime.of(10, 0));
		laterSameDay.setEndTime(LocalTime.of(10, 30));

		Commitment earlierSameDay = new Commitment();
		earlierSameDay.setTitle("Planning");
		earlierSameDay.setCommitmentDate(LocalDate.of(2026, 9, 21));
		earlierSameDay.setStartTime(LocalTime.of(9, 0));
		earlierSameDay.setEndTime(LocalTime.of(9, 30));

		Commitment nextDay = new Commitment();
		nextDay.setTitle("Review");
		nextDay.setCommitmentDate(LocalDate.of(2026, 9, 22));
		nextDay.setStartTime(LocalTime.of(14, 0));
		nextDay.setEndTime(LocalTime.of(15, 0));

		when(commitmentRepository.findByOwner_IdAndCommitmentDateBetweenOrderByCommitmentDateAscStartTimeAsc(
						42L, from, to))
				.thenReturn(List.of(earlierSameDay, laterSameDay, nextDay));

		List<CommitmentResponse> responses = commitmentService.list(from, to);

		assertThat(responses)
				.extracting(CommitmentResponse::title)
				.containsExactly("Planning", "Standup", "Review");
		assertThat(responses)
				.extracting(CommitmentResponse::commitmentDate)
				.containsExactly(
						LocalDate.of(2026, 9, 21),
						LocalDate.of(2026, 9, 21),
						LocalDate.of(2026, 9, 22));
	}

	private static ValidRequestBuilder validRequest() {
		return new ValidRequestBuilder();
	}

	private static final class ValidRequestBuilder {

		private String title = "Standup";
		private LocalDate commitmentDate = LocalDate.of(2026, 9, 21);
		private LocalTime startTime = LocalTime.of(10, 0);
		private LocalTime endTime = LocalTime.of(10, 30);

		ValidRequestBuilder withTitle(String title) {
			this.title = title;
			return this;
		}

		ValidRequestBuilder withCommitmentDate(LocalDate commitmentDate) {
			this.commitmentDate = commitmentDate;
			return this;
		}

		ValidRequestBuilder withStartTime(LocalTime startTime) {
			this.startTime = startTime;
			return this;
		}

		ValidRequestBuilder withEndTime(LocalTime endTime) {
			this.endTime = endTime;
			return this;
		}

		CommitmentRequest build() {
			return new CommitmentRequest(title, commitmentDate, startTime, endTime);
		}
	}
}
