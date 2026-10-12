package com.focusflow.task;

import com.focusflow.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "unplanned_work")
public class UnplannedWork {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_id", nullable = false)
	private User owner;

	@Column(name = "source_task_id", nullable = false)
	private Long sourceTaskId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "task_reference_id")
	private Task taskReference;

	@Column(name = "work_date", nullable = false)
	private LocalDate workDate;

	@Column(name = "actual_minutes", nullable = false)
	private Integer actualMinutes;

	@Column(name = "recorded_at", nullable = false)
	private Instant recordedAt;

	public Long getId() {
		return id;
	}

	public User getOwner() {
		return owner;
	}

	public void setOwner(User owner) {
		this.owner = owner;
	}

	public Long getSourceTaskId() {
		return sourceTaskId;
	}

	public void setSourceTaskId(Long sourceTaskId) {
		this.sourceTaskId = sourceTaskId;
	}

	public Task getTaskReference() {
		return taskReference;
	}

	public void setTaskReference(Task taskReference) {
		this.taskReference = taskReference;
	}

	public LocalDate getWorkDate() {
		return workDate;
	}

	public void setWorkDate(LocalDate workDate) {
		this.workDate = workDate;
	}

	public Integer getActualMinutes() {
		return actualMinutes;
	}

	public void setActualMinutes(Integer actualMinutes) {
		this.actualMinutes = actualMinutes;
	}

	public Instant getRecordedAt() {
		return recordedAt;
	}

	public void setRecordedAt(Instant recordedAt) {
		this.recordedAt = recordedAt;
	}
}
