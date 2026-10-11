# FocusFlow Roadmap — Enterprise-Grade Planning Iteration

Last updated: 2026-10-11

This tracks a multi-milestone iteration aimed at making FocusFlow's planning features closer to enterprise-grade: real scheduling on a clock, rest-aware planning, work that spans days, and the platform hardening needed to carry it. It exists so the milestones after the one currently in progress do not get lost between brainstorming sessions.

**How to use this doc:** Before brainstorming the next milestone, read its section below for the scope and decisions already settled. Brainstorming that milestone may refine or override anything here — treat this as a starting point, not a contract. After a milestone's spec is written, update this doc's status table and fold any new cross-milestone decisions back in here.

## Status

| Milestone | Status | Spec |
|---|---|---|
| 1.1.0 — Platform hardening | Implemented and merged. | [`2026-08-26-focusflow-1.1.0-platform-hardening-design.md`](specs/2026-08-26-focusflow-1.1.0-platform-hardening-design.md) |
| 1.2.0 — The scheduled day | Implemented. | [`2026-09-07-focusflow-1.2.0-scheduled-day-design.md`](specs/2026-09-07-focusflow-1.2.0-scheduled-day-design.md); [`2026-09-07-focusflow-1.2.0-scheduled-day-plan.md`](plans/2026-09-07-focusflow-1.2.0-scheduled-day-plan.md) |
| 1.3.0 — Progress and carry-over | Implementation plan written. | [`2026-10-02-focusflow-1.3.0-progress-carry-over-design.md`](specs/2026-10-02-focusflow-1.3.0-progress-carry-over-design.md); [`2026-10-02-focusflow-1.3.0-progress-carry-over-plan.md`](plans/2026-10-02-focusflow-1.3.0-progress-carry-over-plan.md) |
| 1.4.0 — Dependencies and the multi-day horizon | Spec reviewed. | [`2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md`](specs/2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md) |

Deferred items with no milestone assigned are listed at the end.

## Cross-milestone decisions already settled

These constrain later milestones and should be treated as settled unless something learned while building changes them. 1.2.0 ADRs are `docs/adr/0002`–`0025`. 1.3.0 ADRs are [`0026`](../adr/0026-checkpointed-remaining-effort.md) and [`0027`](../adr/0027-revision-preserving-replan.md). 1.4.0 ADRs are [`0028`](../adr/0028-inherited-dependency-urgency.md) through [`0035`](../adr/0035-horizon-snapshot-read.md).

- **Time model:** wall-clock `LocalTime` / `LocalDate`. No timezone preference. The client supplies the planning date and, for 1.3.0 progress and re-planning, the current date and cutoff. The server does not infer them. ([0009](../adr/0009-wall-clock-times.md))
- **Planning horizon:** daily planning stays one day at a time. 1.4.0 adds a read-only horizon over the next seven working days, starting from the client's current date and time and calculated on read from the single-day scheduler. Saved Daily plans stay the only committed schedules. Forecast days use a fixed order and the as-planned pace; they do not call the model. Only eligible unrecorded sessions count, and each read uses one snapshot without the owner lock. ([0031](../adr/0031-derived-horizon-forecast.md), [0034](../adr/0034-horizon-assumed-credit.md), [0035](../adr/0035-horizon-snapshot-read.md))
- **Working weekdays:** scheduling preferences name the weekdays the horizon counts, defaulting to Monday through Friday. A non-working date appears only when it already has a Daily plan. Generate and re-plan still accept any date. ([0032](../adr/0032-working-weekdays-for-horizon.md))
- **Dependencies:** finish-to-start links only. Done and Cancelled blockers release the dependent and keep the link. Urgency passes only through Open or In-progress tasks. A blocker inherits the urgency of the plannable work waiting on it, including forecast-started work. Planned completion lets the dependent be scheduled without marking the blocker Done. Java repairs dependency order after ranking validation. A dependent whose blocker is not fully placed is unplaced as `BLOCKED`, which also covers an unestimated blocker. Link edits do not mark a saved plan as needing refresh. ([0028](../adr/0028-inherited-dependency-urgency.md), [0029](../adr/0029-repair-dependency-order.md), [0030](../adr/0030-blocked-unplaced-reason.md), [0033](../adr/0033-finished-blockers-release.md))
- **Who schedules:** the AI returns one ordered id array for at most 100 plannable tasks. A two-stage Java scheduler takes that ordering plus the work window, break rules, commitments, buffer, and current remaining effort, places work until time is exhausted, and validates postconditions. For each task in a revision, placed work plus unplaced effort equals that revision's captured remaining effort, not necessarily the whole-task estimate. Ranked candidates become one Daily-plan-task snapshot each; scheduled work blocks reference it. `DailyPlanRankingValidator` polices ids, completeness, and block order. From 1.4.0, Java then repairs dependency order before placement. ([0006](../adr/0006-ai-total-ordering.md), [0015](../adr/0015-two-stage-scheduler.md), [0018](../adr/0018-snapshot-task-data-in-plans.md), [0022](../adr/0022-bound-ai-ranking-requests.md), [0026](../adr/0026-checkpointed-remaining-effort.md), [0029](../adr/0029-repair-dependency-order.md))
- **Plan identity:** at most one Daily plan per owner and planning date. Regeneration of a plan with no work outcome uses owner-serialized compare-and-replace and produces a new plan id. A plan with any work outcome is retained; re-planning appends a schedule revision to that same plan. The plan read route is `/by-date`. ([0002](../adr/0002-one-plan-per-date.md), [0025](../adr/0025-owner-scheduling-lock.md), [0027](../adr/0027-revision-preserving-replan.md))
- **Progress tracking:** specified in 1.3.0. Actual minutes are time spent. Remaining effort is the current estimate of time still needed; done provisionally credits planned duration, partly done credits actual minutes, and an explicit reassessment is a checkpoint. Carry-over happens when a later day is generated. Re-planning preserves revisions, and a stale progress save or re-plan is rejected. ([0026](../adr/0026-checkpointed-remaining-effort.md), [0027](../adr/0027-revision-preserving-replan.md))
- **Rest model:** optional focus cadence (target stretch plus break length, with a minimum session that remains active when cadence is disabled, look-ahead tail absorb, and early breaks) combined with fixed-time breaks and commitments as unavailable time, plus a trailing buffer. Buffer reserves the latest free minutes and records requested versus realized duration. Commitments do not count as rest. ([0005](../adr/0005-cadence-session-splitting.md), [0008](../adr/0008-trailing-buffer.md), [0010](../adr/0010-breaks-and-commitments-separate.md), [0023](../adr/0023-minimum-session-without-cadence.md), [0024](../adr/0024-realized-buffer-time.md))
- **Peak hours:** stored and shaded; they do not affect placement. ([0007](../adr/0007-peak-hours-display-only.md))
- **Unestimated work:** stays in the plan as unplaced, never given a fabricated duration. ([0004](../adr/0004-unplaced-unestimated-work.md))
- **Overflow:** the work window is a hard boundary; must-include remainder is unplaced `OUT_OF_TIME`. From 1.4.0, a task whose blocker was not fully placed is unplaced as `BLOCKED` instead, with none of its effort placed in an earlier gap. ([0013](../adr/0013-window-is-a-hard-boundary.md), [0030](../adr/0030-blocked-unplaced-reason.md))
- **Planning date:** still explicit at the API. 1.2.0 closed the "revisit after timezone preferences" thread by deciding there are no timezone preferences.
- **Historical work:** Daily plan tasks snapshot source-task identity, title, priority, status, due date, whole-task estimate, and remaining effort while retaining an optional live reference; descriptions are not stored. From 1.4.0, the snapshot also records the remaining-effort checkpoint captured with that effort. Task edits and deletion do not rewrite history. From 1.3.0, outcomes, unplanned work, and checkpoints also survive Task deletion. ([0018](../adr/0018-snapshot-task-data-in-plans.md), [0034](../adr/0034-horizon-assumed-credit.md))
- **Deadline warnings:** 1.3.0 warns when due or overdue work does not fit the day being planned. 1.4.0 adds the horizon forecast: on track, at risk, overdue, beyond the horizon, or cannot forecast. Explanations name direct blockers at the deadline and separate upstream causes. The task list badges at risk, overdue, and cannot forecast. Blocked must-include work is listed on its own in the daily warning and is still counted in required minutes. Optional blocked work does not raise that warning.

## 1.2.0 — The scheduled day

Implemented. See the spec and ADRs rather than this outline.

## 1.3.0 — Progress and carry-over

Implementation plan written. See the [1.3.0 design](specs/2026-10-02-focusflow-1.3.0-progress-carry-over-design.md), the [1.3.0 plan](plans/2026-10-02-focusflow-1.3.0-progress-carry-over-plan.md), and ADRs [`0026`](../adr/0026-checkpointed-remaining-effort.md) and [`0027`](../adr/0027-revision-preserving-replan.md). The placement algorithm is unchanged; planning consumes current remaining effort, and re-planning appends a revision instead of replacing a plan that has outcomes.

## 1.4.0 — Dependencies and the multi-day horizon

Spec reviewed. See the [1.4.0 design](specs/2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md) and ADRs [`0028`](../adr/0028-inherited-dependency-urgency.md) through [`0035`](../adr/0035-horizon-snapshot-read.md). It overrides the earlier outline: the scheduler does change, by leaving dependents of an unfinished blocker unplaced as `BLOCKED`, and the horizon is a calculated forecast rather than a stored multi-day plan.

## Deferred, no milestone assigned

Recorded so they aren't reconsidered from scratch, and so a future brainstorming session can slot them in deliberately rather than by default.

- **Recurring tasks** (daily/weekly repeats) — largely a separate subsystem for generating task instances; barely touches the scheduler, so it can slot into any milestone.
- **Subtasks and task hierarchy** (parent tasks with children, rolled-up estimates and progress) — a significant change to the `Task` aggregate and every existing query; large enough to deserve its own milestone if pursued.
- **Audit timestamps and optimistic locking** (`createdAt`/`updatedAt` via JPA auditing, `@Version` where concurrent edits are plausible) — small, low-risk backend improvement, considered during 1.1.0 platform hardening and cut for scope. 1.3.0 adds effort and progress versions only for its progress and re-plan conflict checks; it does not add general auditing or row versions on every aggregate.
- **Generate rate limiting** (per-user cap on plan generation to bound provider cost) — considered during 1.1.0 and cut for scope.
- **Task list pagination** (`GET /api/tasks`) — 1.1.0 paginates plan history only; the task list was left unpaginated deliberately since it's typically much smaller.
- **Structured JSON logging** — deferred from 1.1.0 observability work; needs another dependency and makes local development harder to read without a log viewer.
- **Peak-aware placement** — 1.2.0 stores and shades the peak window only; automatic peak-first placement can land later without a schema change.
- **Per-day window override on generate** — rejected for 1.2.0; change saved preferences instead.
- **Manual block editing / drag-to-reschedule** — not in 1.2.0.

## Related specs

- [Parent spec](specs/2026-05-14-focusflow-ai-design.md) — original product and architecture design.
- [1.0.2 design](specs/2026-08-22-focusflow-1.0.2-design.md) — plan delete, must-include ranking rules, shortfall warning.
- [1.1.0 design](specs/2026-08-26-focusflow-1.1.0-platform-hardening-design.md) — Flyway, pagination, explicit planning date; must ship before 1.2.0.
- [1.2.0 design](specs/2026-09-07-focusflow-1.2.0-scheduled-day-design.md) — the scheduled day.
- [1.3.0 design](specs/2026-10-02-focusflow-1.3.0-progress-carry-over-design.md) — progress, carry-over, and revision-preserving re-planning.
- [1.4.0 design](specs/2026-10-11-focusflow-1.4.0-dependencies-horizon-design.md) — task dependencies and the read-only multi-day horizon.
- [Frontend UI design](specs/2026-05-31-focusflow-frontend-ui-design.md) — confirmation, toast, and alert patterns reused by later milestones.
