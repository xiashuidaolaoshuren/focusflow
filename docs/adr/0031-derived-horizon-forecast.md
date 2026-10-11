# The multi-day horizon is a read-only as-planned forecast

The horizon is calculated on read for the next seven working days. Dates with a Daily plan show that plan. Other working days run the existing scheduler in a fixed order: started work, inherited urgency, inherited due date, priority, task id, then dependency repair. Unrecorded sessions on saved plans consume their planned minutes up to the live remainder. No horizon row is stored, and the forecast makes no provider call.

A persisted week plan was rejected because Daily plans are already the commitment, and a second stored schedule would have to be reconciled every time a day changes. Ranking each forecast day with the model was rejected because a read would spend a provider call and could change between refreshes. A pace learned from history was rejected for this milestone because as-planned is explainable from the sessions already on the plan.
