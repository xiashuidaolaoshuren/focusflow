# Snapshot requested and realized buffer time

The plan records both the configured buffer request and the free time actually reserved after breaks and commitments are applied. If 120 minutes are requested but only 60 minutes are free, the scheduler reserves all 60, leaves work unplaced normally, and the timeline can explain why contingency was reduced. Rejecting generation conflicts with a fully unavailable day being valid; silently exposing only the smaller value hides an unmet preference.
