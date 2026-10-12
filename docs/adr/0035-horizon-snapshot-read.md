# Horizon reads use one snapshot and do not take the scheduling lock

A horizon response loads tasks, checkpoints, links, preferences, commitments, and saved plans from one read-only snapshot. It does not take the owner scheduling lock, call the provider, or write. A concurrent progress save is entirely before that snapshot or entirely after it.

Taking the lock was rejected because a forecast must not block planning or progress. Reading each input separately without a snapshot was rejected because the response could combine a remainder from before a save with the outcome recorded by that save.
