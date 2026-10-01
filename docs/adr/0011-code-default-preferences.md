# Missing preferences resolve to in-code defaults

A user with no `scheduling_preferences` row still generates against 09:00–18:00, an enabled 50/10 target cadence, a 15-minute minimum session, no buffer, no peak, and no fixed breaks. `GET` returns those effective values with `persisted: false`; saving is the first write. Requiring settings first would regress generate for every existing user. Backfilling a row at migration would duplicate defaults in SQL and code.
