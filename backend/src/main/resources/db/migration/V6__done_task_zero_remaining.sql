-- A finished Task has a known zero remainder (1.3.0), so the positivity check from
-- V5 must allow zero when the Task is DONE. Unfinished Tasks still need a positive
-- or unknown remainder. Tasks completed before this milestone keep their backfilled
-- positive estimate, so a positive remainder stays valid for DONE rows too.
ALTER TABLE tasks
    DROP CONSTRAINT ck_tasks_remaining_effort_minutes_positive;

ALTER TABLE tasks
    ADD CONSTRAINT ck_tasks_remaining_effort_minutes_positive_or_done_zero
    CHECK (
        remaining_effort_minutes IS NULL
        OR remaining_effort_minutes > 0
        OR (status = 'DONE' AND remaining_effort_minutes = 0)
    );
