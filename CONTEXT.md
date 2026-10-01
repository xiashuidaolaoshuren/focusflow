# FocusFlow

FocusFlow helps an individual turn owned tasks into a realistic clock schedule for focused work. This glossary defines the product language shared by planning, task management, and scheduling.

## Tasks

**Task**:
A user-owned unit of work with a status, priority, optional due date, and optional effort estimate.
_Avoid_: Plan item, work block, commitment

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
The complete view of one Daily plan, including Scheduled blocks and Unplaced work.

**Plan summary**:
The reduced view of a Daily plan used in plan history. It describes the plan without including its entries.

**The plan for a date**:
The one Daily plan for an owner and Planning date. Generating again replaces it.
_Avoid_: Latest plan for a date

**Generation snapshot**:
The Plannable task state, effective Scheduling preferences, and Commitments used to make decisions for one plan-generation attempt. Later edits do not retroactively change those decisions.

**Schedule snapshot**:
The Work window, Peak window, constraints, and source-task data copied onto a Daily plan at generate time so later edits do not rewrite history.

**Daily plan task**:
One ranked snapshot of a Plannable task in a Daily plan. It owns the task snapshot and any Unplaced work.

**Daily plan block**:
One minute-aligned clock interval inside a Daily plan. Work blocks reference a Daily plan task; other kinds do not.

**Scheduled block**:
The API view of a placed Daily plan block.

**Work session**:
A Scheduled block of work for one Task snapshot. Several sessions of the same source Task may exist in one Daily plan.

**Unplaced work**:
The API view of a Daily plan task that is not on the clock, or has a remaining unplaced portion, because its source Task has no estimate or the day ran out of time.

**Free minutes**:
Minutes remaining in the Work window after Fixed breaks, overlapping Commitments, and the Trailing buffer are removed. Cadence breaks consume some of this time.

**Scheduled work minutes**:
The sum of durations of Work sessions after cadence and unavailable intervals are applied.

**Required minutes**:
The sum of known estimates on Must-include work at generate time.

**Shortfall warning**:
A notice that some Must-include work is Unplaced work.

**Task snapshot**:
Immutable source-task identity, title, priority, status, due date, and estimate copied into a Daily plan task at generation, with an optional reference to the live Task. It excludes free-form description.

## Preferences

**Scheduling preferences**:
The owner's Work window, Focus cadence, Minimum session, Trailing buffer, optional Peak window, and Fixed breaks. Missing preferences resolve to in-code defaults.
_Avoid_: Settings (when meaning the persisted aggregate)
