package com.focusflow.plan;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DailyPlanRepository extends JpaRepository<DailyPlan, Long> {

	@EntityGraph(
			attributePaths = {
				"revisions",
				"revisions.tasks",
				"revisions.blocks",
				"revisions.blocks.dailyPlanTask"
			})
	Optional<DailyPlan> findByOwner_IdAndId(Long ownerId, Long planId);

	@Query(
			value =
					"""
					SELECT p.id AS id, p.planDate AS planDate, p.createdAt AS createdAt,
					       (SELECT r.scheduledWorkMinutes FROM DailyPlanRevision r
					        WHERE r.dailyPlan.id = p.id
					          AND r.revisionNumber = (
					              SELECT MAX(r2.revisionNumber) FROM DailyPlanRevision r2
					              WHERE r2.dailyPlan.id = p.id))
					           AS scheduledWorkMinutes,
					       (SELECT COUNT(b) FROM DailyPlanBlock b
					        JOIN b.revision r
					        WHERE r.dailyPlan.id = p.id
					          AND r.revisionNumber = (
					              SELECT MAX(r2.revisionNumber) FROM DailyPlanRevision r2
					              WHERE r2.dailyPlan.id = p.id)
					          AND b.kind = com.focusflow.schedule.BlockKind.WORK)
					           AS workSessionCount,
					       (SELECT COUNT(DISTINCT b.dailyPlanTask.id) FROM DailyPlanBlock b
					        JOIN b.revision r
					        WHERE r.dailyPlan.id = p.id
					          AND r.revisionNumber = (
					              SELECT MAX(r2.revisionNumber) FROM DailyPlanRevision r2
					              WHERE r2.dailyPlan.id = p.id)
					          AND b.kind = com.focusflow.schedule.BlockKind.WORK)
					           AS scheduledTaskCount,
					       (SELECT COUNT(t) FROM DailyPlanTask t
					        JOIN t.revision r
					        WHERE r.dailyPlan.id = p.id
					          AND r.revisionNumber = (
					              SELECT MAX(r2.revisionNumber) FROM DailyPlanRevision r2
					              WHERE r2.dailyPlan.id = p.id)
					          AND t.unplacedReason IS NOT NULL)
					           AS unplacedWorkCount,
					       EXISTS (SELECT t FROM DailyPlanTask t
					               JOIN t.revision r
					               WHERE r.dailyPlan.id = p.id
					                 AND r.revisionNumber = (
					                     SELECT MAX(r2.revisionNumber) FROM DailyPlanRevision r2
					                     WHERE r2.dailyPlan.id = p.id)
					                 AND t.mustInclude = true
					                 AND t.unplacedReason IS NOT NULL) AS hasWarning
					FROM DailyPlan p
					WHERE p.owner.id = :ownerId
					ORDER BY p.createdAt DESC, p.id DESC
					""",
			countQuery = "SELECT COUNT(p) FROM DailyPlan p WHERE p.owner.id = :ownerId")
	Page<DailyPlanSummaryProjection> findSummariesByOwner(
			@Param("ownerId") Long ownerId, Pageable pageable);

	@EntityGraph(
			attributePaths = {
				"revisions",
				"revisions.tasks",
				"revisions.blocks",
				"revisions.blocks.dailyPlanTask"
			})
	Optional<DailyPlan> findFirstByOwner_IdAndPlanDateOrderByCreatedAtDescIdDesc(
			Long ownerId, LocalDate planDate);
}
