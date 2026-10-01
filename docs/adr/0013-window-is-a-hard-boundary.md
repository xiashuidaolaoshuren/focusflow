# Required work that does not fit is unplaced, not overflow past the window

The scheduler places only what fits inside the work window. Must-include remainder becomes unplaced work with reason `OUT_OF_TIME` and feeds the shortfall warning. The rail never crosses the snapshot `windowEnd`. Overflow-past-end would answer "you'd have to work until 20:30" at the cost of making the window decorative. Refusing to generate would hide a still-useful partial schedule behind an error.
