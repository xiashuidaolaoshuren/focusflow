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
import java.util.Comparator;
import java.util.LinkedHashSet;
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

	@Column(name = "cadence_enabled")
	private Boolean cadenceEnabled;

	@Column(name = "target_focus_minutes")
	private Integer targetFocusMinutes;

	@Column(name = "break_minutes")
	private Integer breakMinutes;

	@Column(name = "min_session_minutes")
	private Integer minSessionMinutes;

	@Column(name = "buffer_minutes")
	private Integer bufferMinutes;

	@OneToMany(
			mappedBy = "dailyPlan",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("revisionNumber ASC")
	private final Set<DailyPlanRevision> revisions = new LinkedHashSet<>();

	@OneToMany(
			mappedBy = "dailyPlan",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	private final Set<PlanFixedBreakSnapshot> fixedBreakSnapshots = new LinkedHashSet<>();

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

	public Boolean getCadenceEnabled() {
		return cadenceEnabled;
	}

	public void setCadenceEnabled(Boolean cadenceEnabled) {
		this.cadenceEnabled = cadenceEnabled;
	}

	public Integer getTargetFocusMinutes() {
		return targetFocusMinutes;
	}

	public void setTargetFocusMinutes(Integer targetFocusMinutes) {
		this.targetFocusMinutes = targetFocusMinutes;
	}

	public Integer getBreakMinutes() {
		return breakMinutes;
	}

	public void setBreakMinutes(Integer breakMinutes) {
		this.breakMinutes = breakMinutes;
	}

	public Integer getMinSessionMinutes() {
		return minSessionMinutes;
	}

	public void setMinSessionMinutes(Integer minSessionMinutes) {
		this.minSessionMinutes = minSessionMinutes;
	}

	public Integer getBufferMinutes() {
		return bufferMinutes;
	}

	public void setBufferMinutes(Integer bufferMinutes) {
		this.bufferMinutes = bufferMinutes;
	}

	public Set<DailyPlanRevision> getRevisions() {
		return revisions;
	}

	public Set<PlanFixedBreakSnapshot> getFixedBreakSnapshots() {
		return fixedBreakSnapshots;
	}

	public DailyPlanRevision getLatestRevision() {
		return revisions.stream()
				.max(Comparator.comparingInt(DailyPlanRevision::getRevisionNumber))
				.orElseThrow(() -> new IllegalStateException("plan has no revisions"));
	}

	public void addRevision(DailyPlanRevision revision) {
		revisions.add(revision);
		revision.setDailyPlan(this);
	}

	public void addFixedBreakSnapshot(PlanFixedBreakSnapshot snapshot) {
		fixedBreakSnapshots.add(snapshot);
		snapshot.setDailyPlan(this);
	}
}
