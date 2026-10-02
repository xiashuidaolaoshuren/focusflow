# FocusFlow

FocusFlow helps an individual turn owned tasks into a realistic clock schedule for focused work. This glossary defines the product language shared by planning, task management, and scheduling.

## Tasks

**Task**:
A user-owned unit of work with a status, priority, optional due date, an optional Whole-task estimate, and Remaining effort.
_Avoid_: Plan item, work block, commitment

**Whole-task estimate**:
The Task's estimate of its complete effort. It initializes Remaining effort and remains available for comparison.
_Avoid_: Remaining effort, actual minutes

**Remaining effort**:
The current estimate of minutes still needed to finish a Task. It is unknown until an estimate or an explicit assessment exists.
_Avoid_: Actual minutes, whole-task estimate

**Actual minutes**:
Time spent on work. Unknown actual time is neither zero nor the planned duration.
_Avoid_: Planned duration, remaining effort

**Work outcome**:
The recorded result of one planned work block: done, partly done, or skipped.

**Remaining-effort checkpoint**:
An explicit reassessment of Remaining effort. Work dated before it remains history and does not change that reassessment.

**Unplanned work**:
Time recorded against a Task on a date without a planned work block.
_Avoid_: Work session, scheduled block

**Plannable task**:
A Task that may appear in a new Daily plan. Its status is Open or In progress.
_Avoid_: Active task, open task (when referring to both statuses)

**Must-continue work**:
Every plannable Task already In progress. It must appear before newly started work in the ranking.

**Due/overdue work**:
Open work whose due date is on or before the Planning date. It must appear before Optional work in the ranking.
_Avoid_: Due today

**Optional work**:
Open work with no due date or a due date after the Planning date. The scheduler may leave it unplaced when the day is full.

**Must-include work**:
Must-continue work together with Due/overdue work.

## Time

**Work window**:
The wall-clock span of one planning day, from a start time to an end time.
_Avoid_: Available minutes, day length, available focus minutes

**Focus cadence**:
An optional target focus stretch together with a cadence-break length. It shapes work sessions without creating fragments shorter than the Minimum session.

**Minimum session**:
The shortest work block the scheduler emits as its own session, unless a leftover fragment is all that remains. It applies whether Focus cadence is enabled or disabled.

**Fixed break**:
A labelled unavailable window that repeats every planning day, stored with Scheduling preferences.
_Avoid_: Lunch (when meaning the general concept)

**Commitment**:
A labelled unavailable window on one calendar date. It is not a Task.

**Trailing buffer**:
The latest free minutes in the Work window reserved as contingency and shown as one or more blocks. Its realized duration may be lower than its requested duration.

**Peak window**:
An optional wall-clock span shaded on the timeline. It does not change placement.

**Wall-clock time**:
A minute-aligned time of day without a timezone. Nine o'clock means 09:00 on the Planning date.
_Avoid_: Instant, UTC, local now (at an API boundary)

## Plans

**Daily plan**:
The single user-owned schedule generated for one Planning date.
_Avoid_: Latest plan for a date, schedule (as a second noun for the same aggregate)

**Planning date**:
The calendar date assigned to a Daily plan. Planning operations name it explicitly rather than relying on an unspecified “today.”
_Avoid_: Server date, today (at an API boundary)

**Plan detail**:
The complete view of one Daily plan, including its actionable schedule, recorded progress, and earlier Schedule revisions.

**Plan summary**:
The reduced view of a Daily plan used in plan history. It describes the plan without including its entries.

**The plan for a date**:
The one Daily plan for an owner and Planning date. Regeneration replaces it only when it has no Work outcome; Re-planning keeps it.
_Avoid_: Latest plan for a date

**Schedule revision**:
One complete scheduling result retained by a Daily plan. The latest revision is actionable, and earlier revisions are history.
_Avoid_: Replacement plan

**Regeneration**:
Replacement of a Daily plan that has no Work outcome with a new plan for the same Planning date.
_Avoid_: Re-plan

**Re-plan**:
A new Schedule revision for the unelapsed remainder of the current day's existing Daily plan.
_Avoid_: Regeneration, replace plan

**No longer needed**:
A planned work session kept after its Task is finished or cancelled, without an invented Work outcome or Actual minutes.

**Needs refresh**:
The state of a Daily plan whose captured effort assumptions no longer match live Remaining effort.

**Generation snapshot**:
The Plannable task state, effective Scheduling preferences, and Commitments used to make decisions for one plan-generation attempt. Later edits do not retroactively change those decisions.

**Schedule snapshot**:
The Work window, Peak window, focus and break constraints, Fixed breaks, and source-task data copied onto a Daily plan at planning time so later edits do not rewrite history.

**Daily plan task**:
One ranked snapshot of a Plannable task in a Schedule revision. It owns the task snapshot and any Unplaced work for that revision.

**Daily plan block**:
One minute-aligned clock interval inside a Schedule revision. Work blocks reference a Daily plan task; other kinds do not.

**Scheduled block**:
The API view of a placed Daily plan block.

**Work session**:
A Scheduled block of work for one Task snapshot. Several sessions of the same source Task may exist in one Daily plan.

**Unplaced work**:
The API view of a Daily plan task that is not on the clock, or has a remaining unplaced portion, because its Remaining effort is unknown or the day ran out of time.

**Free minutes**:
Minutes remaining in the Work window after Fixed breaks, overlapping Commitments, and the Trailing buffer are removed. Cadence breaks consume some of this time.

**Scheduled work minutes**:
The sum of durations of Work sessions after cadence and unavailable intervals are applied.

**Required minutes**:
The sum of known Remaining effort on Must-include work when a Schedule revision is planned.

**Shortfall warning**:
A notice that some Must-include work is Unplaced work.

**Task snapshot**:
Immutable source-task identity, title, priority, status, due date, Whole-task estimate, and Remaining effort copied into a Daily plan task when a Schedule revision is planned, with an optional reference to the live Task. It excludes free-form description.

## Preferences

**Scheduling preferences**:
The owner's Work window, Focus cadence, Minimum session, Trailing buffer, optional Peak window, and Fixed breaks. Missing preferences resolve to in-code defaults.
_Avoid_: Settings (when meaning the persisted aggregate)
