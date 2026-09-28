package com.focusflow.plan;

import com.focusflow.schedule.BlockKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalTime;

@Entity
@Table(name = "daily_plan_blocks")
public class DailyPlanBlock {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "daily_plan_id", nullable = false)
	private DailyPlan dailyPlan;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "daily_plan_task_id")
	private DailyPlanTask dailyPlanTask;

	@Enumerated(EnumType.STRING)
	@Column(nullable = false)
	private BlockKind kind;

	@Column(name = "start_time", nullable = false)
	private LocalTime startTime;

	@Column(name = "end_time", nullable = false)
	private LocalTime endTime;

	@Column
	private String label;

	@Column(nullable = false)
	private int position;

	public Long getId() {
		return id;
	}

	public DailyPlan getDailyPlan() {
		return dailyPlan;
	}

	public void setDailyPlan(DailyPlan dailyPlan) {
		this.dailyPlan = dailyPlan;
	}

	public DailyPlanTask getDailyPlanTask() {
		return dailyPlanTask;
	}

	public void setDailyPlanTask(DailyPlanTask dailyPlanTask) {
		this.dailyPlanTask = dailyPlanTask;
	}

	public BlockKind getKind() {
		return kind;
	}

	public void setKind(BlockKind kind) {
		this.kind = kind;
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

	public String getLabel() {
		return label;
	}

	public void setLabel(String label) {
		this.label = label;
	}

	public int getPosition() {
		return position;
	}

	public void setPosition(int position) {
		this.position = position;
	}
}
