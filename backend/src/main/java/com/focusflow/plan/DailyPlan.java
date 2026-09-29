package com.focusflow.plan;

import com.focusflow.user.User;
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
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "daily_plans")
public class DailyPlan {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_id", nullable = false)
	private User owner;

	@Column(name = "plan_date", nullable = false)
	private LocalDate planDate;

	@Column(name = "created_at", nullable = false)
	private Instant createdAt;

	@Column(name = "window_start", nullable = false)
	private LocalTime windowStart;

	@Column(name = "window_end", nullable = false)
	private LocalTime windowEnd;

	@Column(name = "peak_start")
	private LocalTime peakStart;

	@Column(name = "peak_end")
	private LocalTime peakEnd;

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

	@OneToMany(
			mappedBy = "dailyPlan",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("rank ASC")
	private final List<DailyPlanTask> tasks = new ArrayList<>();

	@OneToMany(
			mappedBy = "dailyPlan",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("position ASC")
	private final Set<DailyPlanBlock> blocks = new LinkedHashSet<>();

	public Long getId() {
		return id;
	}

	public User getOwner() {
		return owner;
	}

	public void setOwner(User owner) {
		this.owner = owner;
	}

	public LocalDate getPlanDate() {
		return planDate;
	}

	public void setPlanDate(LocalDate planDate) {
		this.planDate = planDate;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public void setCreatedAt(Instant createdAt) {
		this.createdAt = createdAt;
	}

	public LocalTime getWindowStart() {
		return windowStart;
	}

	public void setWindowStart(LocalTime windowStart) {
		this.windowStart = windowStart;
	}

	public LocalTime getWindowEnd() {
		return windowEnd;
	}

	public void setWindowEnd(LocalTime windowEnd) {
		this.windowEnd = windowEnd;
	}

	public LocalTime getPeakStart() {
		return peakStart;
	}

	public void setPeakStart(LocalTime peakStart) {
		this.peakStart = peakStart;
	}

	public LocalTime getPeakEnd() {
		return peakEnd;
	}

	public void setPeakEnd(LocalTime peakEnd) {
		this.peakEnd = peakEnd;
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

	public List<DailyPlanTask> getTasks() {
		return tasks;
	}

	public Set<DailyPlanBlock> getBlocks() {
		return blocks;
	}

	public void addTask(DailyPlanTask task) {
		tasks.add(task);
		task.setDailyPlan(this);
	}

	public void addBlock(DailyPlanBlock block) {
		blocks.add(block);
		block.setDailyPlan(this);
	}
}
