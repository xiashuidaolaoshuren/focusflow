# Peak hours shade the rail; they do not reorder placement

The peak window is stored on preferences, snapshotted onto the plan, and shaded on the timeline. Placement stays front-to-back in ranking order so the schedule remains the ranking. Peak-first placement would put a top task at 14:00 and a fifth task at 09:00, and for the common "sharpest in the morning" preference it would be a no-op. Schema for the window exists now so 1.3.0+ can change behaviour without a migration.
