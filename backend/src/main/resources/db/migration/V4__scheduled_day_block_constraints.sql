ALTER TABLE daily_plan_blocks
    ADD CONSTRAINT ck_daily_plan_blocks_positive_interval
    CHECK (end_time > start_time),
    ADD CONSTRAINT ck_daily_plan_blocks_kind_shape
    CHECK (
        (kind = 'WORK' AND daily_plan_task_id IS NOT NULL AND label IS NULL)
        OR (kind <> 'WORK' AND daily_plan_task_id IS NULL AND label IS NOT NULL)
    );