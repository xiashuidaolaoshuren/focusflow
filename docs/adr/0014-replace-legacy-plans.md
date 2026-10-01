# Pre-1.2.0 plans are deleted at migration

The Flyway step that introduces Scheduled blocks deletes every `daily_plans` and `daily_plan_items` row, then adds the unique `(owner_id, plan_date)` constraint. Tasks are untouched. Keeping the previously latest plan per date would leave null clock times and a permanent list-only rendering path. Enforcing uniqueness only in the service would allow duplicate dates to creep back. Plans are disposable daily artifacts; the README treats this like 1.1.0's backup-first adoption procedure because Flyway is forward-only.
