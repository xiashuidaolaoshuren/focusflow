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

@Entity
@Table(name = "task_dependencies")
public class TaskDependency {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_id", nullable = false)
	private User owner;

	@Column(name = "blocked_task_id", nullable = false)
	private long blockedTaskId;

	@Column(name = "blocker_task_id", nullable = false)
	private long blockerTaskId;

	public Long getId() {
		return id;
	}

	public User getOwner() {
		return owner;
	}

	public void setOwner(User owner) {
		this.owner = owner;
	}

	public long getBlockedTaskId() {
		return blockedTaskId;
	}

	public void setBlockedTaskId(long blockedTaskId) {
		this.blockedTaskId = blockedTaskId;
	}

	public long getBlockerTaskId() {
		return blockerTaskId;
	}

	public void setBlockerTaskId(long blockerTaskId) {
		this.blockerTaskId = blockerTaskId;
	}
}
