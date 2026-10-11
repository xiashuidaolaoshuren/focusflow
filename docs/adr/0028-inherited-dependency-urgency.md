# A blocker inherits the urgency of the work waiting on it

A finish-to-start blocker takes the most urgent ranking group among itself and the plannable tasks it blocks, including through a chain. Its stored status and due date stay unchanged. Must-include is then true for inherited must-continue and due/overdue work, so a blocker of work due today ranks with that work.

Leaving the blocker in its own group was rejected because must-include order and dependency order would contradict each other: a task due today would have to rank before the optional task that blocks it. Demoting the blocked task out of must-include was rejected because the day would no longer be required to face the deadline. Refusing to generate was rejected because the owner would have to delete a valid link to plan the day.
