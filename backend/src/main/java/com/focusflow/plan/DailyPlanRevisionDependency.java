package com.focusflow.plan;

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
@Table(name = "daily_plan_revision_dependencies")
public class DailyPlanRevisionDependency {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "revision_id", nullable = false)
	private DailyPlanRevision revision;

	@Column(name = "blocked_source_task_id", nullable = false)
	private long blockedSourceTaskId;

	@Column(name = "blocker_source_task_id", nullable = false)
	private long blockerSourceTaskId;

	public Long getId() {
		return id;
	}

	public DailyPlanRevision getRevision() {
		return revision;
	}

	public void setRevision(DailyPlanRevision revision) {
		this.revision = revision;
	}

	public long getBlockedSourceTaskId() {
		return blockedSourceTaskId;
	}

	public void setBlockedSourceTaskId(long blockedSourceTaskId) {
		this.blockedSourceTaskId = blockedSourceTaskId;
	}

	public long getBlockerSourceTaskId() {
		return blockerSourceTaskId;
	}

	public void setBlockerSourceTaskId(long blockerSourceTaskId) {
		this.blockerSourceTaskId = blockerSourceTaskId;
	}
}
