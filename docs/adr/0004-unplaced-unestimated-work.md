# Unestimated work is unplaced, not invented

`estimatedMinutes` stays optional on Task. The scheduler will not invent a duration, so a task with no estimate is kept in the plan as unplaced work with reason `NO_ESTIMATE` and never occupies the rail. That narrows 1.0.2's must-include guarantee from "always scheduled" to "always in the plan." A default-duration preference would make the clock lie; making estimates required would force a backfill and a form change this milestone does not need.
