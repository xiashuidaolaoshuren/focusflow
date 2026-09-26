package com.focusflow.schedule;

import java.util.List;

public record PlacementResult(List<ScheduledBlock> blocks, List<UnplacedWork> unplacedWork) {}
