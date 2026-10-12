# Done and Cancelled blockers release the dependent and keep the link

Only Open and In-progress blockers constrain ranking, placement, and the horizon. Finishing or cancelling a blocker releases its dependents on the next plan or forecast. Reopening the blocker, which already requires a fresh remaining-effort assessment, makes the same link active again. Cycle detection still sees links through finished tasks, so a cycle cannot hide behind a Done task and reappear on reopen.

Deleting the link on finish was rejected because reopening would forget the dependency. Keeping a Cancelled blocker active until the owner removes the link was rejected because cancelled work is already out of planning, and the dependent would stay unschedulable with no task left to do.
