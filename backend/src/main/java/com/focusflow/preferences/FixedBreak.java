package com.focusflow.preferences;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalTime;

@Entity
@Table(name = "fixed_breaks")
public class FixedBreak {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "scheduling_preferences_id", nullable = false)
	private SchedulingPreferences schedulingPreferences;

	@Column(nullable = false)
	private String label;

	@Column(name = "start_time", nullable = false)
	private LocalTime startTime;

	@Column(name = "end_time", nullable = false)
	private LocalTime endTime;

	public Long getId() {
		return id;
	}

	public SchedulingPreferences getSchedulingPreferences() {
		return schedulingPreferences;
	}

	public void setSchedulingPreferences(SchedulingPreferences schedulingPreferences) {
		this.schedulingPreferences = schedulingPreferences;
	}

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public LocalTime getStartTime() {
		return startTime;
	}

	public void setStartTime(LocalTime startTime) {
		this.startTime = startTime;
	}

	public LocalTime getEndTime() {
		return endTime;
	}

	public void setEndTime(LocalTime endTime) {
		this.endTime = endTime;
	}
}
