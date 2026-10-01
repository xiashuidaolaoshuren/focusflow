# FocusFlow Roadmap — Enterprise-Grade Planning Iteration

Last updated: 2026-09-22

This tracks a multi-milestone iteration aimed at making FocusFlow's planning features closer to enterprise-grade: real scheduling on a clock, rest-aware planning, work that spans days, and the platform hardening needed to carry it. It exists so the milestones after the one currently in progress do not get lost between brainstorming sessions.

**How to use this doc:** Before brainstorming the next milestone, read its section below for the scope and decisions already settled. Brainstorming that milestone may refine or override anything here — treat this as a starting point, not a contract. After a milestone's spec is written, update this doc's status table and fold any new cross-milestone decisions back in here.

## Status

| Milestone | Status | Spec |
|---|---|---|
| 1.1.0 — Platform hardening | Implemented and merged. | [`2026-08-26-focusflow-1.1.0-platform-hardening-design.md`](specs/2026-08-26-focusflow-1.1.0-platform-hardening-design.md) |
| 1.2.0 — The scheduled day | Implementation plan written. | [`2026-09-07-focusflow-1.2.0-scheduled-day-design.md`](specs/2026-09-07-focusflow-1.2.0-scheduled-day-design.md); [`2026-09-07-focusflow-1.2.0-scheduled-day-plan.md`](plans/2026-09-07-focusflow-1.2.0-scheduled-day-plan.md) |
| 1.3.0 — Progress and carry-over | Not started. Scope outlined below. | — |
| 1.4.0 — Dependencies and the multi-day horizon | Not started. Scope outlined below. | — |

Deferred items with no milestone assigned are listed at the end.

## Cross-milestone decisions already settled

These constrain later milestones and should be treated as settled unless something learned while building changes them. 1.2.0 ADRs are `docs/adr/0002`–`0025`.

- **Time model:** wall-clock `LocalTime` / `LocalDate`. No timezone preference. The client supplies the planning date now and can supply "now" in 1.3.0. ([0009](../adr/0009-wall-clock-times.md))
- **Planning horizon:** this iteration plans one day at a time with clock times, breaks, and (in 1.3.0) carry-over. A multi-day Gantt is 1.4.0, built on the single-day scheduler, not a replacement for it.
- **Who schedules:** the AI returns one ordered id array for at most 100 plannable tasks. A two-stage Java scheduler takes that ordering plus the work window, break rules, commitments, buffer, and remaining effort, places work until time is exhausted, and validates postconditions. Ranked candidates become one Daily-plan-task snapshot each; scheduled work blocks reference it. `DailyPlanRankingValidator` polices ordering only. ([0006](../adr/0006-ai-total-ordering.md), [0015](../adr/0015-two-stage-scheduler.md), [0018](../adr/0018-snapshot-task-data-in-plans.md), [0022](../adr/0022-bound-ai-ranking-requests.md))
- **Plan identity:** at most one Daily plan per owner and planning date. Generate uses owner-serialized compare-and-replace rather than unconditional replacement, producing a new plan id on each regeneration. The plan read route is `/by-date`. ([0002](../adr/0002-one-plan-per-date.md), [0025](../adr/0025-owner-scheduling-lock.md))
- **Progress tracking:** still 1.3.0. Actuals will be recorded against plan blocks (done / partly done / skipped, with optional actual minutes). Remaining effort for carry-over is derived from block actuals. 1.3.0 must not silently replace a plan that has actuals.
- **Rest model:** optional focus cadence (target stretch plus break length, with a minimum session that remains active when cadence is disabled, look-ahead tail absorb, and early breaks) combined with fixed-time breaks and commitments as unavailable time, plus a trailing buffer. Buffer reserves the latest free minutes and records requested versus realized duration. Commitments do not count as rest. ([0005](../adr/0005-cadence-session-splitting.md), [0008](../adr/0008-trailing-buffer.md), [0010](../adr/0010-breaks-and-commitments-separate.md), [0023](../adr/0023-minimum-session-without-cadence.md), [0024](../adr/0024-realized-buffer-time.md))
- **Peak hours:** stored and shaded; they do not affect placement. ([0007](../adr/0007-peak-hours-display-only.md))
- **Unestimated work:** stays in the plan as unplaced, never given a fabricated duration. ([0004](../adr/0004-unplaced-unestimated-work.md))
- **Overflow:** the work window is a hard boundary; must-include remainder is unplaced `OUT_OF_TIME`. ([0013](../adr/0013-window-is-a-hard-boundary.md))
- **Planning date:** still explicit at the API. 1.2.0 closed the "revisit after timezone preferences" thread by deciding there are no timezone preferences.
- **Historical work:** Daily plan tasks snapshot source-task identity, title, priority, status, due date, and estimate while retaining an optional live reference; descriptions are not stored. Task edits and deletion do not rewrite history. ([0018](../adr/0018-snapshot-task-data-in-plans.md))

## 1.2.0 — The scheduled day

Specified. See the spec and ADRs rather than this outline.

## 1.3.0 — Progress and carry-over

Builds on 1.2.0's scheduler without changing it — only what "how much effort is left" means, changes.

- Record actuals against blocks: done, partly done (with actual minutes), or skipped.
- Derive remaining effort for a task from its block actuals across plans, replacing the whole-task `estimatedMinutes` as the only signal.
- Carry unfinished work into a later day's plan automatically.
- Re-plan the rest of a day: if it's 14:00 and the user is behind schedule, reschedule remaining blocks into the hours left, reusing the 1.2.0 scheduler with a shrunk window (stage 1) and adjusted remaining effort. The client supplies current wall-clock time; the server does not infer it.
- Replace-on-generate must confront recorded actuals (refuse, or re-plan only the unplayed remainder).
- Deadline feasibility warnings: extend the 1.0.2 shortfall-warning pattern to say a task will miss its due date given current pace, now that real remaining-effort data exists.
- Timeline shows planned-vs-actual for a day.

## 1.4.0 — Dependencies and the multi-day horizon

- Task dependency graph: task B cannot start until task A finishes. Needs cycle detection at edit time, an API to add/remove links, and UI for setting them.
- Topological ordering layered over the AI's priority ranking — dependencies constrain ordering, not placement, so the 1.2.0/1.3.0 scheduler does not need to change to accommodate them.
- Needs an explicit rule for how a dependency interacts with 1.0.2's must-include rules (e.g. a task due today that is blocked by unfinished work — this collision was flagged during brainstorming and not yet resolved).
- Multi-day Gantt: dates across the top, task bars spanning multiple days, long tasks split into sessions planned across a horizon (e.g. a week) with per-day capacity, and re-planning the horizon when a day goes off track. Horizontal layout, unlike 1.2.0's vertical day rail.
- This is where dependencies' cross-date ripple effects (a slipped blocker pushing every dependent task later) actually pay off, which is why they're grouped with the horizon work rather than built earlier.

## Deferred, no milestone assigned

Recorded so they aren't reconsidered from scratch, and so a future brainstorming session can slot them in deliberately rather than by default.

- **Recurring tasks** (daily/weekly repeats) — largely a separate subsystem for generating task instances; barely touches the scheduler, so it can slot into any milestone.
- **Subtasks and task hierarchy** (parent tasks with children, rolled-up estimates and progress) — a significant change to the `Task` aggregate and every existing query; large enough to deserve its own milestone if pursued.
- **Audit timestamps and optimistic locking** (`createdAt`/`updatedAt` via JPA auditing, `@Version` where concurrent edits are plausible) — small, low-risk backend improvement, considered during 1.1.0 platform hardening and cut for scope.
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
- [Frontend UI design](specs/2026-05-31-focusflow-frontend-ui-design.md) — confirmation, toast, and alert patterns reused by later milestones.
