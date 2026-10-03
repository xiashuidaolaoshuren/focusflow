package com.focusflow.plan;

import com.focusflow.schedule.UnplacedReason;
import com.focusflow.task.Task;
import com.focusflow.task.TaskPriority;
import com.focusflow.task.TaskStatus;
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
import java.time.LocalDate;

@Entity
@Table(name = "daily_plan_tasks")
public class DailyPlanTask {

	@Id
	@GeneratedValue(strategy = GenerationType.IDENTITY)
	private Long id;

	@ManyToOne(fetch = FetchType.LAZY, optional = false)
	@JoinColumn(name = "revision_id", nullable = false)
	private DailyPlanRevision revision;

	@Column(nullable = false)
	private int rank;

	@Column(name = "source_task_id", nullable = false)
	private long sourceTaskId;

	@ManyToOne(fetch = FetchType.LAZY)
	@JoinColumn(name = "task_reference_id")
	private Task taskReference;

	@Column(name = "task_title", nullable = false)
	private String taskTitle;

	@Enumerated(EnumType.STRING)
	@Column(name = "task_priority", nullable = false)
	private TaskPriority taskPriority;

	@Enumerated(EnumType.STRING)
	@Column(name = "task_status", nullable = false)
	private TaskStatus taskStatus;

	@Column(name = "task_due_date")
	private LocalDate taskDueDate;

	@Column(name = "task_estimated_minutes")
	private Integer taskEstimatedMinutes;

	@Column(name = "captured_remaining_effort_minutes")
	private Integer capturedRemainingEffortMinutes;

	@Column(name = "must_include", nullable = false)
	private boolean mustInclude;

	@Enumerated(EnumType.STRING)
	@Column(name = "unplaced_reason")
	private UnplacedReason unplacedReason;

	@Column(name = "unplaced_minutes")
	private Integer unplacedMinutes;

	public Long getId() {
		return id;
	}

	public DailyPlanRevision getRevision() {
		return revision;
	}

	public void setRevision(DailyPlanRevision revision) {
		this.revision = revision;
	}

	public int getRank() {
		return rank;
	}

	public void setRank(int rank) {
		this.rank = rank;
	}

	public long getSourceTaskId() {
		return sourceTaskId;
	}

	public void setSourceTaskId(long sourceTaskId) {
		this.sourceTaskId = sourceTaskId;
	}

	public Long getTaskReferenceId() {
		return taskReference != null ? taskReference.getId() : null;
	}

	public Task getTaskReference() {
		return taskReference;
	}

	public void setTaskReference(Task taskReference) {
		this.taskReference = taskReference;
	}

	public String getTaskTitle() {
		return taskTitle;
	}

	public void setTaskTitle(String taskTitle) {
		this.taskTitle = taskTitle;
	}

	public TaskPriority getTaskPriority() {
		return taskPriority;
	}

	public void setTaskPriority(TaskPriority taskPriority) {
		this.taskPriority = taskPriority;
	}

	public TaskStatus getTaskStatus() {
		return taskStatus;
	}

	public void setTaskStatus(TaskStatus taskStatus) {
		this.taskStatus = taskStatus;
	}

	public LocalDate getTaskDueDate() {
		return taskDueDate;
	}

	public void setTaskDueDate(LocalDate taskDueDate) {
		this.taskDueDate = taskDueDate;
	}

	public Integer getTaskEstimatedMinutes() {
		return taskEstimatedMinutes;
	}

	public void setTaskEstimatedMinutes(Integer taskEstimatedMinutes) {
		this.taskEstimatedMinutes = taskEstimatedMinutes;
	}

	public Integer getCapturedRemainingEffortMinutes() {
		return capturedRemainingEffortMinutes;
	}

	public void setCapturedRemainingEffortMinutes(Integer capturedRemainingEffortMinutes) {
		this.capturedRemainingEffortMinutes = capturedRemainingEffortMinutes;
	}

	public boolean isMustInclude() {
		return mustInclude;
	}

	public void setMustInclude(boolean mustInclude) {
		this.mustInclude = mustInclude;
	}

	public UnplacedReason getUnplacedReason() {
		return unplacedReason;
	}

	public void setUnplacedReason(UnplacedReason unplacedReason) {
		this.unplacedReason = unplacedReason;
	}

	public Integer getUnplacedMinutes() {
		return unplacedMinutes;
	}

	public void setUnplacedMinutes(Integer unplacedMinutes) {
		this.unplacedMinutes = unplacedMinutes;
	}
}
