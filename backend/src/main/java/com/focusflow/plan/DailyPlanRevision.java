package com.focusflow.plan;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalTime;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "daily_plan_revisions")
public class DailyPlanRevision {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "daily_plan_id", nullable = false)
	private DailyPlan dailyPlan;

	@Column(name = "revision_number", nullable = false)
	private int revisionNumber;

	@Column(name = "cutoff_time")
	private LocalTime cutoffTime;

	@Column(name = "free_minutes", nullable = false)
	private int freeMinutes;

	@Column(name = "scheduled_work_minutes", nullable = false)
	private int scheduledWorkMinutes;

	@Column(name = "required_minutes", nullable = false)
	private long requiredMinutes;

	@Column(name = "requested_buffer_minutes", nullable = false)
	private int requestedBufferMinutes;

	@Column(name = "realized_buffer_minutes", nullable = false)
	private int realizedBufferMinutes;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@OneToMany(
			mappedBy = "revision",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("rank ASC")
	private final Set<DailyPlanTask> tasks = new LinkedHashSet<>();

	@OneToMany(
			mappedBy = "revision",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("position ASC")
	private final Set<DailyPlanBlock> blocks = new LinkedHashSet<>();

	public Long getId() {
		return id;
	}

	public DailyPlan getDailyPlan() {
		return dailyPlan;
	}

	public void setDailyPlan(DailyPlan dailyPlan) {
		this.dailyPlan = dailyPlan;
	}

	public int getRevisionNumber() {
		return revisionNumber;
	}

	public void setRevisionNumber(int revisionNumber) {
		this.revisionNumber = revisionNumber;
	}

	public LocalTime getCutoffTime() {
		return cutoffTime;
	}

	public void setCutoffTime(LocalTime cutoffTime) {
		this.cutoffTime = cutoffTime;
	}

	public int getFreeMinutes() {
		return freeMinutes;
	}

	public void setFreeMinutes(int freeMinutes) {
		this.freeMinutes = freeMinutes;
	}

	public int getScheduledWorkMinutes() {
		return scheduledWorkMinutes;
	}

	public void setScheduledWorkMinutes(int scheduledWorkMinutes) {
		this.scheduledWorkMinutes = scheduledWorkMinutes;
	}

	public long getRequiredMinutes() {
		return requiredMinutes;
	}

	public void setRequiredMinutes(long requiredMinutes) {
		this.requiredMinutes = requiredMinutes;
	}

	public int getRequestedBufferMinutes() {
		return requestedBufferMinutes;
	}

	public void setRequestedBufferMinutes(int requestedBufferMinutes) {
		this.requestedBufferMinutes = requestedBufferMinutes;
	}

	public int getRealizedBufferMinutes() {
		return realizedBufferMinutes;
	}

	public void setRealizedBufferMinutes(int realizedBufferMinutes) {
		this.realizedBufferMinutes = realizedBufferMinutes;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}

	public Set<DailyPlanTask> getTasks() {
		return tasks;
	}

	public Set<DailyPlanBlock> getBlocks() {
		return blocks;
	}

	public void addTask(DailyPlanTask task) {
		tasks.add(task);
		task.setRevision(this);
	}

	public void addBlock(DailyPlanBlock block) {
		blocks.add(block);
		block.setRevision(this);
	}
}
