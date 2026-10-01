# Serialize scheduling mutations on the owner row

Plan create, replace, and delete; commitment create, update, and delete; and scheduling-preferences `PUT` all lock the owner row before checking and changing scheduling state. This one per-user boundary preserves compare-and-replace, preference singleton, and no-overlapping-commitment invariants without PostgreSQL-specific exclusion extensions. Task CRUD deliberately stays outside it because generation operates on a snapshot and rechecks only source-task deletion before persist.
