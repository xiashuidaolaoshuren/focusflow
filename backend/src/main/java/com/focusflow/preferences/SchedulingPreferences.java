package com.focusflow.preferences;

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
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "scheduling_preferences")
public class SchedulingPreferences {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "owner_id", nullable = false, unique = true)
	private User owner;

	@Column(name = "work_day_start", nullable = false)
	private LocalTime workDayStart;

	@Column(name = "work_day_end", nullable = false)
	private LocalTime workDayEnd;

	@Column(name = "cadence_enabled", nullable = false)
	private boolean cadenceEnabled;

	@Column(name = "target_focus_minutes", nullable = false)
	private int targetFocusMinutes;

	@Column(name = "break_minutes", nullable = false)
	private int breakMinutes;

	@Column(name = "min_session_minutes", nullable = false)
	private int minSessionMinutes;

	@Column(name = "buffer_minutes", nullable = false)
	private int bufferMinutes;

	@Column(name = "working_monday", nullable = false)
	private boolean workingMonday = true;

	@Column(name = "working_tuesday", nullable = false)
	private boolean workingTuesday = true;

	@Column(name = "working_wednesday", nullable = false)
	private boolean workingWednesday = true;

	@Column(name = "working_thursday", nullable = false)
	private boolean workingThursday = true;

	@Column(name = "working_friday", nullable = false)
	private boolean workingFriday = true;

	@Column(name = "working_saturday", nullable = false)
	private boolean workingSaturday = false;

	@Column(name = "working_sunday", nullable = false)
	private boolean workingSunday = false;

	@Column(name = "peak_start")
	private LocalTime peakStart;

	@Column(name = "peak_end")
	private LocalTime peakEnd;

	@OneToMany(
			mappedBy = "schedulingPreferences",
			cascade = CascadeType.ALL,
			orphanRemoval = true)
	@OrderBy("startTime ASC")
	private List<FixedBreak> fixedBreaks = new ArrayList<>();

	public Long getId() {
		return id;
	}

	public User getOwner() {
		return owner;
	}

	public void setOwner(User owner) {
		this.owner = owner;
	}

	public LocalTime getWorkDayStart() {
		return workDayStart;
	}

	public void setWorkDayStart(LocalTime workDayStart) {
		this.workDayStart = workDayStart;
	}

	public LocalTime getWorkDayEnd() {
		return workDayEnd;
	}

	public void setWorkDayEnd(LocalTime workDayEnd) {
		this.workDayEnd = workDayEnd;
	}

	public boolean isCadenceEnabled() {
		return cadenceEnabled;
	}

	public void setCadenceEnabled(boolean cadenceEnabled) {
		this.cadenceEnabled = cadenceEnabled;
	}

	public int getTargetFocusMinutes() {
		return targetFocusMinutes;
	}

	public void setTargetFocusMinutes(int targetFocusMinutes) {
		this.targetFocusMinutes = targetFocusMinutes;
	}

	public int getBreakMinutes() {
		return breakMinutes;
	}

	public void setBreakMinutes(int breakMinutes) {
		this.breakMinutes = breakMinutes;
	}

	public int getMinSessionMinutes() {
		return minSessionMinutes;
	}

	public void setMinSessionMinutes(int minSessionMinutes) {
		this.minSessionMinutes = minSessionMinutes;
	}

	public int getBufferMinutes() {
		return bufferMinutes;
	}

	public void setBufferMinutes(int bufferMinutes) {
		this.bufferMinutes = bufferMinutes;
	}

	public boolean isWorkingMonday() {
		return workingMonday;
	}

	public void setWorkingMonday(boolean workingMonday) {
		this.workingMonday = workingMonday;
	}

	public boolean isWorkingTuesday() {
		return workingTuesday;
	}

	public void setWorkingTuesday(boolean workingTuesday) {
		this.workingTuesday = workingTuesday;
	}

	public boolean isWorkingWednesday() {
		return workingWednesday;
	}

	public void setWorkingWednesday(boolean workingWednesday) {
		this.workingWednesday = workingWednesday;
	}

	public boolean isWorkingThursday() {
		return workingThursday;
	}

	public void setWorkingThursday(boolean workingThursday) {
		this.workingThursday = workingThursday;
	}

	public boolean isWorkingFriday() {
		return workingFriday;
	}

	public void setWorkingFriday(boolean workingFriday) {
		this.workingFriday = workingFriday;
	}

	public boolean isWorkingSaturday() {
		return workingSaturday;
	}

	public void setWorkingSaturday(boolean workingSaturday) {
		this.workingSaturday = workingSaturday;
	}

	public boolean isWorkingSunday() {
		return workingSunday;
	}

	public void setWorkingSunday(boolean workingSunday) {
		this.workingSunday = workingSunday;
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

	public List<FixedBreak> getFixedBreaks() {
		return fixedBreaks;
	}

	public void setFixedBreaks(List<FixedBreak> fixedBreaks) {
		this.fixedBreaks = fixedBreaks;
	}
}
