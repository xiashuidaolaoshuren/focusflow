# The shortfall warning is derived from unplaced must-include rows

1.0.2 stored a JSON snapshot beside items that could drift from those items. Unplaced work is now real rows with `NO_ESTIMATE` or `OUT_OF_TIME`, so the warning mapper reads must-include unplaced rows plus the plan's `requiredMinutes`, `freeMinutes`, and `scheduledWorkMinutes`. The `warning` jsonb column is dropped, and no `hasWarning` cache bit is stored; the summary query derives the same predicate with `EXISTS`. Optional unplaced work does not warn.
