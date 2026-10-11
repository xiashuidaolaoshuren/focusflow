# Java repairs dependency order after the ranking is validated

The model still returns one total order, labeled with inherited groups and active blockers. Validation still rejects unknown ids, duplicates, missing candidates, and block-order violations. Java then keeps the earliest legal original position among tasks whose blockers are already emitted, and the saved rank is that repaired order.

Rejecting a dependency inversion as a provider failure was rejected because the constraint is fixed and needs no guess; an intra-group mistake would become a 502. Asking the model to be the only enforcer was rejected because intra-group order is otherwise left to the model and would leak blocked work onto the clock. Repair that moves a later group ahead of an earlier one fails the plan unsaved, because urgency inheritance makes that outcome a broken invariant.
